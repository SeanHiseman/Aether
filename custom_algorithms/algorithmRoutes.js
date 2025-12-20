import { Algorithms, AlgorithmLocations } from './algorithmRelationships.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import OpenAI from 'openai';
import { Router } from 'express';
import { v4 } from 'uuid';
import sequelize from '../databaseSetup.js';

const analyser = new ContentAnalyser();
const openai = new OpenAI();
const router = Router();

router.post('/assign_algorithm', authenticateCheck, async (req, res) => {
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const { algorithmId, locationId } = req.body;
		//console.log("assigning algorithm", algorithmId, "to:", locationId);
		const viewerId = req.session.viewer_id;
		const [record, created] = await AlgorithmLocations.findOrCreate({
			where: { location_id: locationId, viewer_id: viewerId },
			defaults: { id: v4(), algorithm_id: algorithmId },
			transaction
		});
		if (!created) {
			await record.update({ algorithm_id: algorithmId }, { transaction });
		} 
		await transaction.commit();
		res.status(200).json({ success: true });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), "/assign_algorithm error:", error);
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	//console.time("total");
	let transaction;
	try {
		//console.time("transaction_start");
		//console.log("creating algorithm");
		transaction = await sequelize.transaction();
		//console.timeEnd("transaction_start");
		const { algorithmName, activeDays, chronology, contentType, customInstruction, dateFrom, dateTo, generateCode, locationId, minWords, maxWords, minVideo, maxVideo, sentiment, startTime, endTime, variety, voteImpact, wordBoost, wordSuppress } = req.body;
		const viewerId = req.session.viewer_id;
		//console.time("build_algorithm_json");
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
			dateLimits: { from: dateFrom || null, to: dateTo || null },
			scoring: {
				sentiment,
				voteImpact,
				wordBoost: Array.isArray(wordBoost) ? wordBoost : [],
				wordSuppress: Array.isArray(wordSuppress) ? wordSuppress : []
			}
		};
		//console.timeEnd("build_algorithm_json");
		//console.log("algorithmJson:", algorithmJson);
		//console.time("fetch_existing_algorithm");
		let existingAlgorithm = null;
		if (req.body.algorithmId) {
			existingAlgorithm = await Algorithms.findOne({
				where: { algorithm_id: req.body.algorithmId, viewer_id: viewerId },
				transaction
			});
		}
		if (!existingAlgorithm) {
			existingAlgorithm = await Algorithms.findOne({
				where: { algorithm_name: algorithmName, viewer_id: viewerId },
				transaction
			});
		}
		//console.timeEnd("fetch_existing_algorithm");
		//Compare arrays
		const sameWords = (a = [], b = []) => {
			if (a.length !== b.length) return false;
			const sa = [...a].sort();
			const sb = [...b].sort();
			return sa.every((v, i) => v === sb[i]);
		};
		const normalizeAlgorithmCode = (code) => {
			const parsed = typeof code === 'string' ? JSON.parse(code) : code;
			//Remove fields that don't affect AI generation
			delete parsed.customFilters;
			delete parsed.customScoring;
			return parsed;
		};
		//Extract previous state
		let prevInstruction = '';
		let prevParsedCode = null;
		let prevBoost = [];
		let prevSuppress = [];
		if (existingAlgorithm) {
			prevInstruction = existingAlgorithm.custom_instruction || '';
			prevParsedCode = normalizeAlgorithmCode(existingAlgorithm.algorithm_code);
			if (prevParsedCode?.scoring?.wordBoost) {
				prevBoost = prevParsedCode.scoring.wordBoost;
			}
			if (prevParsedCode?.scoring?.wordSuppress) {
				prevSuppress = prevParsedCode.scoring.wordSuppress;
			}
		}
		const currentInstruction = customInstruction || '';
		const currentParsedCode = normalizeAlgorithmCode(algorithmJson);
		const stringifySorted = obj => JSON.stringify(obj, Object.keys(obj).sort(), 2);
		const sameStructure = prevParsedCode 
			? stringifySorted(prevParsedCode) === stringifySorted(currentParsedCode)
			: false;
		//Determine if custom instruction changed
		const instructionChanged = prevInstruction !== currentInstruction;
		//Determine if boost/suppress words changed
		const boostChanged = !sameWords(algorithmJson.scoring.wordBoost, prevBoost);
		const suppressChanged = !sameWords(algorithmJson.scoring.wordSuppress, prevSuppress);
		//Only name changed
		if (existingAlgorithm && 
		    algorithmName !== existingAlgorithm.algorithm_name &&
		    !instructionChanged &&
		    sameStructure) {
			//console.log("Name-only change detected - skipping AI and embeddings");
			//console.time("rename_only_update");
			const algorithm = await existingAlgorithm.update(
				{ algorithm_name: algorithmName },
				{ transaction }
			);
			await transaction.commit();
			//console.timeEnd("rename_only_update");
			//console.timeEnd("total");
			return res.status(200).json({
				success: true,
				algorithm: {
					...algorithm.toJSON(),
					algorithm_locations: [{ location_id: locationId }]
				}
			});
		}
		//Determine if we need to call AI
		const needsAiGeneration = generateCode && 
		                          currentInstruction.trim() !== "" && 
		                          instructionChanged;
		let algorithmCode;
		let finalBoost = algorithmJson.scoring.wordBoost;
		let finalSuppress = algorithmJson.scoring.wordSuppress;
		//console.log("generateCode:", generateCode);
		//console.log("customInstruction:", customInstruction);
		//console.log("instructionChanged:", instructionChanged);
		//console.log("needsAiGeneration:", needsAiGeneration);
		if (needsAiGeneration) {
			//console.time("ai_generation");
			//console.log("Custom instruction changed - calling AI API");
			const systemPrompt = `
				You are an expert algorithm creation assistant. 
				Output a single, valid JSON object strictly following this schema:
				{
					"chronology": number (-1 to 1),
					"variety": number (0 to 1),
					"contentType": { "images": boolean, "videos": boolean, "text": boolean, "interactive": boolean, "externalPosts": boolean, "embeddedWebsites": boolean },
					"activeDays": string[] (each must be a lowercase full weekday name, e.g. "monday", "tuesday"),
					"wordLimits": { "min": number | null, "max": number | null },
					"videoLimits": { "min": number | null, "max": number | null },
					"timeLimits": { "startTime": string | null, "endTime": string | null },
					"dateLimits": { "from": string | null, "to": string | null },
					"scoring": {
						"sentiment": number (0 to 1),
						"voteImpact": number (0 to 1),
						"wordBoost": [],
						"wordSuppress": []
					}
				}
				Merge the form settings with the user's custom instruction. If contradiction, prioritise following custom instruction.  
				No text outside the JSON. Use at least 20 words, or more, for wordBoost and wordSuppress.
			`;
			const userContent = `
				Form Settings:
				${JSON.stringify(algorithmJson, null, 2)}
				Custom Instruction:
				"${customInstruction}"
			`;
			//console.log("sending user content:", userContent);
			const response = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userContent }
				]
			});
			//console.log("response:", response);
			const aiReply = response.choices[0].message.content;
			//console.log("aiReply:", aiReply);
			const parsed = aiReply.replace(/```json\n|```/g, '').trim();
			algorithmCode = parsed;
			const parsedJson = JSON.parse(parsed);
			//console.log("parsedJson:", parsedJson);
			if (parsedJson.scoring) {
				if (Array.isArray(parsedJson.scoring.wordBoost) && parsedJson.scoring.wordBoost.length) {
					finalBoost = parsedJson.scoring.wordBoost;
				}
				if (Array.isArray(parsedJson.scoring.wordSuppress) && parsedJson.scoring.wordSuppress.length) {
					finalSuppress = parsedJson.scoring.wordSuppress;
				}
			}
			//console.timeEnd("ai_generation");
		} else {
			//Use the form values directly
			//console.log("Using form values for algorithm code");
			algorithmCode = JSON.stringify(algorithmJson);
		}
		//Generate embeddings only if words changed
		//console.time("embeddings");
		let boostEmbedding = null;
		let suppressEmbedding = null;
		//Recalculate if final words differ from previous
		const finalBoostChanged = !sameWords(finalBoost, prevBoost);
		const finalSuppressChanged = !sameWords(finalSuppress, prevSuppress);
		if (Array.isArray(finalBoost) && finalBoost.length > 0 && finalBoostChanged) {
			//console.log("Boost words changed - generating new embeddings");
			boostEmbedding = await Promise.all(finalBoost.map(word => analyser.generateEmbedding(word)));
		} else if (existingAlgorithm && !finalBoostChanged && prevBoost.length > 0) {
			//console.log("Boost words unchanged - reusing existing embeddings");
			boostEmbedding = existingAlgorithm.boost_embedding;
		}
		if (Array.isArray(finalSuppress) && finalSuppress.length > 0 && finalSuppressChanged) {
			//console.log("Suppress words changed - generating new embeddings");
			suppressEmbedding = await Promise.all(finalSuppress.map(word => analyser.generateEmbedding(word)));
		} else if (existingAlgorithm && !finalSuppressChanged && prevSuppress.length > 0) {
			//console.log("Suppress words unchanged - reusing existing embeddings");
			suppressEmbedding = existingAlgorithm.suppress_embedding;
		}
		//console.timeEnd("embeddings");
		//console.time("db_write");
		let algorithm;
		if (existingAlgorithm) {
			//console.log("updating existing algorithm");
			algorithm = await existingAlgorithm.update({
				algorithm_name: algorithmName,
				algorithm_code: algorithmCode,
				custom_instruction: customInstruction || null,
				boost_embedding: boostEmbedding,
				suppress_embedding: suppressEmbedding
			}, { transaction });
		} else {
			//console.log("creating new algorithm");
			algorithm = await Algorithms.create({
				algorithm_id: v4(),
				algorithm_name: algorithmName,
				algorithm_code: algorithmCode,
				custom_instruction: customInstruction || null,
				viewer_id: viewerId,
				boost_embedding: boostEmbedding,
				suppress_embedding: suppressEmbedding
			}, { transaction });
		}
		await transaction.commit();
		//console.timeEnd("db_write");
		//console.log("algorithm:", algorithm);
		//console.timeEnd("total");
		res.status(201).json({
			success: true,
			algorithm: {
				...algorithm.toJSON(),
				algorithm_locations: [{ location_id: locationId }]
			}
		});
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), "/create_algorithm error:", error);
		//console.timeEnd("total");
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