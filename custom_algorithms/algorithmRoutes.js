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
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const { algorithmId, locationId } = req.body;
		const userId = req.session.user_id;
		const [record, created] = await AlgorithmLocations.findOrCreate({
			where: { location_id: locationId, user_id: userId },
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
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	let transaction;
	try {
		const {
			algorithmName,
			chronology,
			contentType,
			customInstruction,
			sentiment,
			startTime,
			endTime,
			variety,
			voteImpact,
			wordBoost,
			wordSuppress,
		} = req.body;
		console.log("create_algorithm req.body:", req.body);
		const userId = req.session.user_id;
		const userSettings = {
			chronology,
			contentType,
			sentiment,
			startTime,
			endTime,
			variety,
			voteImpact,
			wordBoost,
			wordSuppress
		};
		let algorithmCode;
		if (customInstruction && customInstruction.trim() !== "") {
			const systemPrompt = `
				You are an expert algorithm creation assistant. Your task is to generate a single, valid JSON object representing a user's custom algorithm rules.
				The user will provide form settings and/or a custom natural language instruction. You must merge both sources into the final JSON, prioritising the custom instruction when there is any conflict.

				Rules for interpretation:
				1. Broad Topic Expansion: For any mentioned topic, expand into the most exhaustive set of related terms possible — including synonyms, abbreviations, acronyms, hashtags, nicknames, notable people, brands, teams, events, locations, and common misspellings. Use real-world domain knowledge. Example: “Formula 1” must include “F1”, “#F1”, “Grand Prix”, all circuit names, and major team/principal names.
				2. Exclusions: If the instruction says to exclude, remove, hide, or suppress content, always use a "SUPPRESS" rule. Never duplicate this exclusion in wordSuppress.
				3. Temporal Restrictions: If the instruction specifies a day of the week, specific time, or date range, treat it as a hard requirement. Do not allow matching content outside that period. If your schema supports only post_time (HH:MM) or day_of_week (string), map appropriately. Example: “on Sundays” means "day_of_week": "Sunday" as a required condition in the rule.
				4. Combining Conditions: When multiple restrictions apply to the same requirement (e.g., topic + day), place them in the same conditions array for that rule.
				5. Scoring Defaults: Unless explicitly provided, default wordBoost values to 10 and wordSuppress to -10.
				6. Output format: The JSON must strictly follow this schema:
				{
				"chronology": "newest" | "oldest",
				"variety": number,
				"scoring": {
					"sentiment": number,
					"voteImpact": number,
					"wordBoost": [{ "word": string, "value": number }],
					"wordSuppress": [{ "word": string, "value": number }]
				},
				"rules": [{
					"ruleName": string,
					"action": { "type": "SUPPRESS" | "BOOST" | "PENALIZE", "value": number },
					"conditions": [
						{
						"field": "post_time" | "day_of_week" | "body" | "category" | "sentiment_score" | "has_images" | "has_videos" | "has_text",
						"operator": "AFTER" | "BEFORE" | "EQUALS" | "CONTAINS" | "CONTAINS_ANY" | "GREATER_THAN" | "LESS_THAN",
						"value": string | number | boolean | string[]
						}
					],
					"exceptions": [ { "condition": { ... } } ]
				}]}
				7. Validation: All terms, conditions, and rules must be valid per this schema. No extra text outside the JSON.
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
				model: "gpt-4.1-mini",
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
			algorithmCode = JSON.stringify({ //Construct JSON if no custom instruction
				chronology,
				contentType,
				variety,
				scoring: {
					sentiment,
					voteImpact,
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
			algorithm_code: algorithmCode,
			custom_instruction: customInstruction || null,
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
			advancedChronology,
			chronology,
			contentType,
			engagement,
			endTime,
			personalRuleInput,
			sentiment,
			startTime,
			template,
			variety,
			voteImpact,
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
				advancedChronology,
				chronology,
				contentType,
				engagement,
				personalRuleInput,
				sentiment,
				startTime,
				endTime,
				template,
				variety,
				voteImpact,
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
		const { locationId } = req.body;
		const userId = req.session.user_id;
		await AlgorithmLocations.destroy({ where: { location_id: locationId, user_id: userId } });
		res.status(200).json({ success: true });
	} catch (error) {
		res.status(500).json({ success: false, message: 'Failed to remove algorithm.' });
	}
});

export default router;