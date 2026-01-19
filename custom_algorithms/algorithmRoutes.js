import { Algorithms, AlgorithmLocations } from './algorithmRelationships.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import OpenAI from 'openai';
import { Router } from 'express';
import { v4 } from 'uuid';
import sequelize from '../databaseSetup.js';

const analyser = new ContentAnalyser();
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});
const router = Router();

router.post('/assign_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { algorithmId, locationId } = req.body;
		const viewerId = req.session.viewer_id;
		//Check if record exists
		const existing = await AlgorithmLocations.findOne({
			where: { location_id: locationId, viewer_id: viewerId }
		});
		if (existing) {
			await existing.update({ algorithm_id: algorithmId });
		} else {
			await AlgorithmLocations.create({
				id: v4(),
				algorithm_id: algorithmId,
				location_id: locationId,
				viewer_id: viewerId
			});
		}
		res.status(200).json({ success: true });
	} catch (error) {
		//Handle race condition - if duplicate error, try update instead
		if (error.name === 'SequelizeUniqueConstraintError') {
			try {
				const { algorithmId, locationId } = req.body;
				const viewerId = req.session.viewer_id;
				await AlgorithmLocations.update(
					{ algorithm_id: algorithmId },
					{ where: { location_id: locationId, viewer_id: viewerId } }
				);
				return res.status(200).json({ success: true });
			} catch (retryError) {
				console.error(new Date().toISOString(), "/assign_algorithm retry error:", retryError);
			}
		}
		console.error(new Date().toISOString(), "/assign_algorithm error:", error);
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	let transaction;
	const totalTimer = 'create_algorithm_total';
	try {
		console.log('create_algorithm: start');
		console.time(totalTimer);
		console.time('parse_request');
		const { algorithmName, activeDays, chronology, contentType, customInstruction, generateCode, locationId, minWords, maxWords, minVideo, maxVideo, sentiment, startTime, endTime, variety, voteImpact, wordBoost, wordSuppress } = req.body;
		const viewerId = req.session.viewer_id;
		console.timeEnd('parse_request');
		console.time('build_algorithm_json');
		const algorithmJson = {
			chronology,
			contentType,
			variety,
			activeDays: Array.isArray(activeDays)
				? activeDays
				: Object.keys(activeDays).filter(day => activeDays[day]),
			wordLimits: { min: minWords || null, max: maxWords || null },
			videoLimits: { min: minVideo || null, max: maxVideo || null },
			timeLimits: { startTime: startTime || null, endTime: endTime || null },
			scoring: {
				sentiment,
				voteImpact,
				wordBoost: Array.isArray(wordBoost) ? wordBoost : [],
				wordSuppress: Array.isArray(wordSuppress) ? wordSuppress : []
			}
		};
		console.timeEnd('build_algorithm_json');
		console.time('load_existing_algorithm');
		let existingAlgorithm = null;
		if (req.body.algorithmId) {
			console.log('create_algorithm: lookup by algorithmId');
			existingAlgorithm = await Algorithms.findOne({
				where: { algorithm_id: req.body.algorithmId, viewer_id: viewerId }
			});
		}
		if (!existingAlgorithm) {
			console.log('create_algorithm: lookup by algorithmName');
			existingAlgorithm = await Algorithms.findOne({
				where: { algorithm_name: algorithmName, viewer_id: viewerId }
			});
		}
		console.timeEnd('load_existing_algorithm');
		const sameWords = (a = [], b = []) => {
			if (a.length !== b.length) return false;
			const sa = [...a].sort();
			const sb = [...b].sort();
			return sa.every((v, i) => v === sb[i]);
		};
		const normalizeAlgorithmCode = code => {
			const parsed = typeof code === 'string' ? JSON.parse(code) : code;
			delete parsed.customFilters;
			delete parsed.customScoring;
			return parsed;
		};
		console.time('compare_previous_state');
		let prevInstruction = '';
		let prevParsedCode = null;
		let prevBoost = [];
		let prevSuppress = [];
		if (existingAlgorithm) {
			console.log('create_algorithm: existing algorithm found');
			prevInstruction = existingAlgorithm.custom_instruction || '';
			prevParsedCode = normalizeAlgorithmCode(existingAlgorithm.algorithm_code);
			prevBoost = prevParsedCode?.scoring?.wordBoost || [];
			prevSuppress = prevParsedCode?.scoring?.wordSuppress || [];
		}
		const currentInstruction = customInstruction || '';
		const currentParsedCode = normalizeAlgorithmCode(algorithmJson);

		const stringifySorted = obj =>
			JSON.stringify(obj, Object.keys(obj).sort(), 2);
		const sameStructure = prevParsedCode
			? stringifySorted(prevParsedCode) === stringifySorted(currentParsedCode)
			: false;
		const instructionChanged = prevInstruction !== currentInstruction;
		const boostChanged = !sameWords(algorithmJson.scoring.wordBoost, prevBoost);
		const suppressChanged = !sameWords(algorithmJson.scoring.wordSuppress, prevSuppress);
		console.timeEnd('compare_previous_state');
		if (
			existingAlgorithm &&
			algorithmName !== existingAlgorithm.algorithm_name &&
			!instructionChanged &&
			sameStructure
		) {
			console.log('create_algorithm: rename only, no AI or embeddings');
			console.time('rename_transaction');
			transaction = await sequelize.transaction();
			const algorithm = await existingAlgorithm.update(
				{ algorithm_name: algorithmName },
				{ transaction }
			);
			await transaction.commit();
			console.timeEnd('rename_transaction');
			console.timeEnd(totalTimer);
			return res.status(200).json({
				success: true,
				algorithm: {
					...algorithm.toJSON(),
					algorithm_locations: [{ location_id: locationId }]
				}
			});
		}
		const needsAiGeneration =
			generateCode &&
			currentInstruction.trim() !== '' &&
			instructionChanged;
		console.log(
			'create_algorithm: AI generation needed =',
			needsAiGeneration
		);
		let algorithmCode;
		let finalBoost = algorithmJson.scoring.wordBoost;
		let finalSuppress = algorithmJson.scoring.wordSuppress;
		if (needsAiGeneration) {
			console.time('ai_generation');
			console.log('create_algorithm: requesting AI code generation');
			const systemPrompt = `
				You are an expert algorithm creation assistant.
				Output a single valid JSON object matching the provided schema.
				Merge form settings with the custom instruction.
				No text outside the JSON.
				Use concise, relevant terms for wordBoost and wordSuppress.
			`;
			const userContent = `
				Form Settings:
				${JSON.stringify(algorithmJson)}
				Custom Instruction:
				"${customInstruction}"
			`;
			const response = await openai.responses.create({
				model: 'gpt-4o-mini',
				input: [
					{
						role: 'system',
						content: [
							{ type: 'input_text', text: systemPrompt }
						]
					},
					{
						role: 'user',
						content: [
							{ type: 'input_text', text: userContent }
						]
					}
				],
				max_output_tokens: 400
			});
			const aiReply = response.output_text;
			const parsed = aiReply.replace(/```json\n|```/g, '').trim();
			algorithmCode = parsed;
			const parsedJson = JSON.parse(parsed);
			if (parsedJson.scoring) {
				if (Array.isArray(parsedJson.scoring.wordBoost)) {
					finalBoost = parsedJson.scoring.wordBoost;
				}
				if (Array.isArray(parsedJson.scoring.wordSuppress)) {
					finalSuppress = parsedJson.scoring.wordSuppress;
				}
			}
			console.timeEnd('ai_generation');
		} else {
			console.log('create_algorithm: using form-generated code');
			algorithmCode = JSON.stringify(algorithmJson);
		}
		const finalBoostChanged = !sameWords(finalBoost, prevBoost);
		const finalSuppressChanged = !sameWords(finalSuppress, prevSuppress);
		let boostEmbedding = null;
		let suppressEmbedding = null;
		console.time('embedding_generation');
		if (finalBoost.length > 0 && finalBoostChanged) {
			console.log('create_algorithm: generating boost embeddings');
			boostEmbedding = await Promise.all(
				finalBoost.map(word => analyser.generateEmbedding(word))
			);
		} else if (existingAlgorithm && !finalBoostChanged) {
			console.log('create_algorithm: reusing boost embeddings');
			boostEmbedding = existingAlgorithm.boost_embedding;
		}
		if (finalSuppress.length > 0 && finalSuppressChanged) {
			console.log('create_algorithm: generating suppress embeddings');
			suppressEmbedding = await Promise.all(
				finalSuppress.map(word => analyser.generateEmbedding(word))
			);
		} else if (existingAlgorithm && !finalSuppressChanged) {
			console.log('create_algorithm: reusing suppress embeddings');
			suppressEmbedding = existingAlgorithm.suppress_embedding;
		}
		console.timeEnd('embedding_generation');
		console.time('db_transaction');
		transaction = await sequelize.transaction();
		let algorithm;
		if (existingAlgorithm) {
			console.log('create_algorithm: updating algorithm record');
			algorithm = await existingAlgorithm.update(
				{
					algorithm_name: algorithmName,
					algorithm_code: algorithmCode,
					custom_instruction: customInstruction || null,
					boost_embedding: boostEmbedding,
					suppress_embedding: suppressEmbedding
				},
				{ transaction }
			);
		} else {
			console.log('create_algorithm: creating algorithm record');
			algorithm = await Algorithms.create(
				{
					algorithm_id: v4(),
					algorithm_name: algorithmName,
					algorithm_code: algorithmCode,
					custom_instruction: customInstruction || null,
					viewer_id: viewerId,
					boost_embedding: boostEmbedding,
					suppress_embedding: suppressEmbedding
				},
				{ transaction }
			);
		}
		await transaction.commit();
		console.timeEnd('db_transaction');
		console.timeEnd(totalTimer);
		console.log('create_algorithm: success');
		res.status(201).json({
			success: true,
			algorithm: {
				...algorithm.toJSON(),
				algorithm_locations: [{ location_id: locationId }]
			}
		});
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), 'create_algorithm error:', error);
		res.status(500).json({ success: false, message: 'Failed to create or update algorithm.' });
	}
});

router.delete('/delete_algorithm', authenticateCheck, async (req, res) => {
	let transaction
	try {
		transaction = await sequelize.transaction();
		const { algorithmId, locationId } = req.body;
		const viewerId = req.session.viewer_id;
		const existing = await Algorithms.findOne({
			where: { algorithm_id: algorithmId }
		});
		if (!existing) {
			return res.status(400).json({ success: false, message: 'Algorithm not found.' });
		}
		await AlgorithmLocations.destroy({ where: { algorithm_id: algorithmId, location_id: locationId, viewer_id: viewerId }, transaction });
		await Algorithms.destroy({ where: { algorithm_id: algorithmId }, transaction });		
		await transaction.commit();
		res.status(200).json({ success: true });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), "/delete_algorithm error:", error);
		res.status(500).json({ success: false, message: 'Failed to delete algorithm.' });
	}
});

//Only called if local storage is empty
router.get('/get_viewer_algorithms', authenticateCheck, async (req, res) => {
	try {
		const viewerId = req.session.viewer_id;
		const algorithms = await Algorithms.findAll({
			include: [{
				attributes: ['location_id'],
				as: 'algorithm_locations',
				model: AlgorithmLocations,
				required: false
			}],
			where: { viewer_id: viewerId }
		});
		res.status(200).json({ success: true, algorithms });
	} catch (error) {
		console.error(new Date().toISOString(), "/get_viewer_algorithms error:", error);
		res.status(500).json({ success: false, message: 'Failed to get algorithms.' });
	}
});

router.delete('/remove_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { algorithmId, locationId } = req.body;
		//console.log("removing algorithm", algorithmId, "from:", locationId);
		const viewerId = req.session.viewer_id;
		await AlgorithmLocations.destroy({ where: { algorithm_id: algorithmId, location_id: locationId } });
		res.status(200).json({ success: true });
	} catch (error) {
		console.error(new Date().toISOString(), "/remove_algorithm error:", error);
		res.status(500).json({ success: false, message: 'Failed to remove algorithm.' });
	}
});

export default router;