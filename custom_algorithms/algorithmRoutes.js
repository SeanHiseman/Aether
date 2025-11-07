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
		console.log("/assign_algorithm error:", error);
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const { algorithmName, activeDays, chronology, contentType, customInstruction, dateFrom, dateTo, generateCode, locationId, minText, maxText, minVideo, maxVideo, sentiment, startTime, endTime, variety, voteImpact, wordBoost, wordSuppress } = req.body;
		const viewerId = req.session.viewer_id;
		const algorithmJson = {
			chronology,
			contentType,
			variety,
			activeDays: Array.isArray(activeDays) ? activeDays : Object.keys(activeDays).filter(day => activeDays[day]),
			textLimits: { min: minText || null, max: maxText || null },
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
		let algorithmCode;
		let finalBoost = algorithmJson.scoring.wordBoost;
		let finalSuppress = algorithmJson.scoring.wordSuppress;
		if (generateCode && customInstruction && customInstruction.trim() !== "") {
			const systemPrompt = `
				You are an expert algorithm creation assistant. 
				Output a single, valid JSON object strictly following this schema:
				{
					"chronology": number (-1 to 1),
					"variety": number (0 to 1),
					"contentType": { "images": boolean, "videos": boolean, "text": boolean, "interactive": boolean, "externalPosts": boolean, "embeddedWebsites": boolean },
					"activeDays": string[] (each must be a lowercase full weekday name, e.g. "monday", "tuesday"),
					"textLimits": { "min": number | null, "max": number | null },
					"videoLimits": { "min": number | null, "max": number | null },
					"timeLimits": { "startTime": string | null, "endTime": string | null },
					"dateLimits": { "from": string | null, "to": string | null },
					"scoring": {
						"sentiment": number (0 to 1),
						"voteImpact": number (0 to 1),
						"wordBoost": [],
						"wordSuppress": []
					}, 
					"customFilters": [],
					"customScoring": []
				}
				Posts are made to feeds. Each poster_id references a user feed who made the post.
				Database schemas for custom filters/scoring:
				    Post fields: post_id, parent_id, feed_id, channel_id, poster_id, title, content, text_body, replies, views, upvotes, downvotes, text_length, word_count, video_length, sentence_count, image_count, video_count, has_images, has_videos, has_interactive, has_external_posts, has_embedded_websites, has_text, sentiment_score, language, created_at, updated_at
					Feed fields: feed_id, feed_name, decription, follower_count, is_group
					Channel fields: channel_id, channel_name 
				Merge the form settings with the user's custom instruction. If contradiction, prioritise following custom instruction.  
				No text outside the JSON.
			`;
			const userContent = `
				Form Settings:
				${JSON.stringify(algorithmJson, null, 2)}
				Custom Instruction:
				"${customInstruction}"
			`;
			const response = await openai.chat.completions.create({
				model: "gpt-5-mini",
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userContent }
				]
			});
			const aiReply = response.choices[0].message.content;
			const parsed = aiReply.replace(/```json\n|```/g, '').trim();
			algorithmCode = parsed;
			const parsedJson = JSON.parse(parsed);
			//Get word changes from custom instruction response
			if (parsedJson.scoring) {
				if (Array.isArray(parsedJson.scoring.wordBoost) && parsedJson.scoring.wordBoost.length)
					finalBoost = parsedJson.scoring.wordBoost;
				if (Array.isArray(parsedJson.scoring.wordSuppress) && parsedJson.scoring.wordSuppress.length)
					finalSuppress = parsedJson.scoring.wordSuppress;
			}
		} else {
			algorithmCode = JSON.stringify(algorithmJson);
		}
		//Generate embeddings from finalBoost and finalSuppress
		let boostEmbedding = null;
		let suppressEmbedding = null;
		if (Array.isArray(finalBoost) && finalBoost.length > 0) {
			const boostText = finalBoost.join(' ');
			boostEmbedding = await analyser.generateEmbedding(boostText);
		}
		if (Array.isArray(finalSuppress) && finalSuppress.length > 0) {
			const suppressText = finalSuppress.join(' ');
			suppressEmbedding = await analyser.generateEmbedding(suppressText);
		};
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
		let algorithm;
		if (existingAlgorithm) {
			algorithm = await existingAlgorithm.update({
				algorithm_name: algorithmName,
				algorithm_code: algorithmCode,
				custom_instruction: customInstruction || null,
				boost_embedding: boostEmbedding ? JSON.stringify(boostEmbedding) : null,
				suppress_embedding: suppressEmbedding ? JSON.stringify(suppressEmbedding) : null
			}, { transaction });
		} else {
			algorithm = await Algorithms.create({
				algorithm_id: v4(),
				algorithm_name: algorithmName,
				algorithm_code: algorithmCode,
				custom_instruction: customInstruction || null,
				viewer_id: viewerId,
				boost_embedding: boostEmbedding ? JSON.stringify(boostEmbedding) : null,
				suppress_embedding: suppressEmbedding ? JSON.stringify(suppressEmbedding) : null
			}, { transaction });
		}
		await transaction.commit();
		res.status(201).json({
			success: true,
			algorithm: {
				...algorithm.toJSON(),
				algorithm_locations: [{ location_id: locationId }]
			}
		});
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.log("/create_algorithm error:", error);
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
		console.log("/delete_algorithm error:", error);
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
		console.log("/get_viewer_algorithms error:", error);
		res.status(500).json({ success: false, message: 'Failed to get algorithms.' });
	}
});

router.delete('/remove_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { locationId } = req.body;
		const viewerId = req.session.viewer_id;
		await AlgorithmLocations.destroy({ where: { location_id: locationId, viewer_id: viewerId } });
		res.status(200).json({ success: true });
	} catch (error) {
		console.log("/remove_algorithm error:", error);
		res.status(500).json({ success: false, message: 'Failed to remove algorithm.' });
	}
});

export default router;