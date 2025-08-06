import authenticateCheck from '../functions/checks/authenticateCheck.js';
import OpenAI from 'openai';
import { Router } from 'express';
import { v4 } from 'uuid';
import { Algorithms, AlgorithmLocations} from './algorithmRelationships.js';
import { Feeds, Users } from '../models/relationships.js';
import sequelize from '../databaseSetup.js';

const openai = new OpenAI();
const router = Router();

router.post('/assign_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { algorithmId, locationId } = req.body;
		const userId = req.session.user_id;
		const existing = await AlgorithmLocations.findOne({
			where: { algorithm_id: algorithmId, location_id: locationId, user_id: userId }
		});
		if (existing) {
			return res.status(200).json({ success: true, message: 'Algorithm already assigned to this feed.' });
		}
		await AlgorithmLocations.create({ id: v4(), algorithm_id: algorithmId, location_id: locationId, user_id: userId });
		res.status(200).json({ success: true });
	} catch (error) {
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	let transaction;
	try {
		const {
			algorithmName,
			algorithmDescription,
			chronology,
			contentType,
			engagement,
			sentiment,
			strength,
			startTime,
			endTime,
			similarity,
			wordBoost,
			wordSuppress,
			customInstruction
		} = req.body;
		console.log("create_algorithm req.body:", req.body);
		const userId = req.session.user_id;
		const userSettings = {
			chronology,
			contentType,
			sentiment,
			strength,
			startTime,
			endTime,
			similarity,
			wordBoost,
			wordSuppress
		};
		let algorithmCode;
		if (customInstruction && customInstruction.trim() !== "") {
			const systemPrompt = `
				You are an expert algorithm creation assistant. Your task is to generate a single, valid JSON object that represents a user's content filtering and ranking rules.
				The user provides settings via a form and a custom natural language instruction. You must synthesize ALL of this information into the final JSON.

				**IMPORTANT RULES:**
				1.  If the user asks to "exclude", "remove", "hide", or "suppress" content, you MUST use a rule with the action type "SUPPRESS". Do NOT use "wordSuppress" or "PENALIZE" for exclusion requests.
				2.  Prioritize the custom natural language instruction as the primary source of truth for creating "rules".
				3.  Avoid redundancy. Do not create a "wordSuppress" entry and a "SUPPRESS" rule for the same term. The "SUPPRESS" rule is always preferred for exclusion.

				The JSON output MUST conform to the following schema:
				{
				"chronology": "newest" | "oldest",
				"strength": number,
				"scoring": {
					"sentiment": number,
					"similarity": number,
					"wordBoost": [{ "word": string, "value": number }],
					"wordSuppress": [{ "word": string, "value": number }]
				},
				"rules": [
					{
					"ruleName": "A descriptive name for the rule",
					"action": { "type": "SUPPRESS" | "BOOST" | "PENALIZE", "value": number },
					"conditions": [
						{
						"field": "post_time" | "body" | "category" | "sentiment_score" | "has_images" | "has_videos" | "has_text",
						"operator": "AFTER" | "BEFORE" | "EQUALS" | "CONTAINS" | "CONTAINS_ANY" | "GREATER_THAN" | "LESS_THAN",
						"value": string | number | boolean | string[]
						}
					],
					"exceptions": [ { "condition": { ... } } ]
					}
				]
				}
				- For "post_time", use "HH:MM".
				- "has_images", "has_videos", "has_text" are booleans.
				- wordBoost/suppress can default to value 10 / -10 respectively.
			`;
			const userContent = `
				Please create the algorithm JSON based on the following combination of settings.
				**Form Settings:**
				${JSON.stringify(userSettings, null, 2)}
				**Custom Natural Language Instruction:**
				"${customInstruction}"
			`;
			console.log("userContent:", userContent);
			const assistant = await openai.beta.assistants.create({
				name: "Algorithm Creator",
				instructions: systemPrompt,
				model: "gpt-4o-mini",
			});
			const thread = await openai.beta.threads.create();
			await openai.beta.threads.messages.create(thread.id, {
				role: "user",
				content: userContent
			});
			const run = await openai.beta.threads.runs.create(thread.id, {
				assistant_id: assistant.id,
			});
			let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
			while (runStatus.status === "queued" || runStatus.status === "in_progress") {
				await new Promise(resolve => setTimeout(resolve, 1000));
				runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
			}
			if (runStatus.status !== "completed") {
				throw new Error(`AI run failed with status: ${runStatus.status}`);
			}
			const messages = await openai.beta.threads.messages.list(thread.id);
			const aiReply = messages.data.find(msg => msg.role === 'assistant').content[0].text.value;
			algorithmCode = aiReply.replace(/```json\n|```/g, '').trim();
			console.log("AI generated algorithmCode:", algorithmCode);
		} else {
			algorithmCode = JSON.stringify({
				chronology,
				strength,
				scoring: {
					sentiment,
					similarity,
					wordBoost: Array.isArray(wordBoost) ? wordBoost.map(word =>
						typeof word === 'string' ? { word, value: 10 } : word
					) : [],
					wordSuppress: Array.isArray(wordSuppress) ? wordSuppress.map(word =>
						typeof word === 'string' ? { word, value: -10 } : word
					) : []
				},
				rules: []
			});
		}
		transaction = await sequelize.transaction();
		const newAlgorithm = await Algorithms.create({
			algorithm_id: v4(),
			algorithm_name: algorithmName,
			algorithm_description: algorithmDescription || null,
			algorithm_code: algorithmCode,
			user_id: userId
		}, { transaction });
		console.log("newAlgorithm:", newAlgorithm);
		await transaction.commit();
		res.status(201).json({ success: true, newAlgorithm });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error("error creating algorithm:", error);
		res.status(500).json({ success: false, message: 'Failed to create algorithm.' });
	}
});

router.delete('/delete_algorithm', authenticateCheck, async (req, res) => {
	let transaction
	try {
		transaction = await sequelize.transaction();
		const { algorithmId, locationId } = req.body;
		const userId = req.session.user_id;
		const existing = await Algorithms.findOne({
			where: { algorithm_id: algorithmId }
		});
		if (!existing) {
			return res.status(400).json({ success: false, message: 'Algorithm not found.' });
		}
		await AlgorithmLocations.destroy({ where: { algorithm_id: algorithmId, location_id: locationId, user_id: userId }, transaction });
		await Algorithms.destroy({ where: { algorithm_id: algorithmId }, transaction });		
		await transaction.commit();
		res.status(200).json({ success: true });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to remove algorithm.' });
	}
});

router.put('/edit_algorithm', authenticateCheck, async (req, res) => {
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const {
			algorithmDescription,
			algorithmId,
			algorithmName,
			chronology,
			contentType,
			engagement,
			endTime,
			personalRuleInput,
			sentiment,
			similarity,
			startTime,
			strength,
			template,
			wordBoost,
			wordSuppress
		} = req.body;
		const userId = req.session.user_id;
		const algorithm = await Algorithms.findOne({ where: { algorithm_id: algorithmId, user_id: userId } });
		if (!algorithm) throw new Error('Algorithm not found.');
		await algorithm.update({
			algorithm_description: algorithmDescription || null,
			algorithm_name: algorithmName,
			algorithm_code: JSON.stringify({
				chronology,
				contentType,
				engagement,
				personalRuleInput,
				sentiment,
				similarity,
				startTime,
				endTime,
				strength,
				template,
				wordBoost,
				wordSuppress
			})
		}, { transaction });
		await transaction.commit();
		res.status(200).json({ success: true, updatedAlgorithm: algorithm });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to edit algorithm.' });
	}
});

router.get('/get_user_algorithms', authenticateCheck, async (req, res) => {
	try {
		const userId = req.session.user_id;
		const algorithms = await Algorithms.findAll({
			include: [{
				attributes: ['location_id'],
				as: 'algorithm_locations',
				model: AlgorithmLocations,
				required: false
			}],
			where: { user_id: userId }
		});
		res.status(200).json({ success: true, algorithms });
	} catch (error) {
		res.status(500).json({ success: false, message: 'Failed to get algorithms.' });
	}
});

router.delete('/remove_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { algorithmId, locationId } = req.body;
		console.log("remove req.body:", req.body);
		const userId = req.session.user_id;
		const existing = await AlgorithmLocations.findOne({
			where: { algorithm_id: algorithmId, location_id: locationId, user_id: userId }
		});
		if (!existing) {
			console.log("not existing")
			return res.status(400).json({ success: false, message: 'Algorithm not assigned to this feed.' });
		}
		await AlgorithmLocations.destroy({ where: { algorithm_id: algorithmId, location_id: locationId, user_id: userId } });
		res.status(200).json({ success: true });
	} catch (error) {
		console.error("error removing algorithm:", error);
		res.status(500).json({ success: false, message: 'Failed to remove algorithm.' });
	}
});

export default router;