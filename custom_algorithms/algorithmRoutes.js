import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { Router } from 'express';
import { v4 } from 'uuid';
import { Algorithms, FeedAlgorithms } from './algorithmRelationships.js';
import { Feeds, Users } from '../models/relationships.js';
import sequelize from '../databaseSetup.js';

const router = Router();

router.post('/assign_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { algorithmId, feedId } = req.body;
		console.log("algorithmId:", algorithmId);
		console.log("feedId:", feedId);
		const userId = req.session.user_id;
		console.log("userId:", userId);
		const existing = await FeedAlgorithms.findOne({
			where: { algorithm_id: algorithmId, feed_id: feedId, user_id: userId }
		});
		console.log("existing:", existing);
		if (existing) {
			console.log("algorithm already assigned")
			return res.status(400).json({ success: false, message: 'Algorithm already assigned to this feed.' });
		}
		await FeedAlgorithms.create({ id: v4(), algorithm_id: algorithmId, feed_id: feedId, user_id: userId });
		res.status(200).json({ success: true });
	} catch (error) {
		console.error("error adding algorithm:", error);
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	let transaction //Ensures database is only updated when all processes complete successfully
	try {
		transaction = await sequelize.transaction();
		const {
			algorithmName,
			algorithmDescription,
			chronology,
			contentType,
			engagement,
			feedId,
			personalRuleInput,
			sentiment,
			strength,
			template,
			startTime,
			endTime,
			similarity,
			wordBoost,
			wordSuppress
		} = req.body;
		const userId = req.session.user_id;
		const newAlgorithm = await Algorithms.create({
			algorithm_id: v4(),
			algorithm_name: algorithmName,
			algorithm_description: algorithmDescription || null,
			algorithm_code: JSON.stringify({
				chronology,
				contentType,
				engagement,
				personalRuleInput,
				sentiment,
				strength,
				template,
				startTime,
				endTime,
				similarity,
				wordBoost,
				wordSuppress
			}),
			user_id: userId
		}, { transaction });
		await FeedAlgorithms.create({
			id: v4(), algorithm_id: newAlgorithm.algorithm_id, feed_id: feedId, user_id: userId
		}, { transaction });
		await transaction.commit();
		res.status(201).json({ success: true, newAlgorithm });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to create algorithm.' });
	}
});

router.delete('/delete_algorithm', authenticateCheck, async (req, res) => {
	let transaction
	try {
		transaction = await sequelize.transaction();
		const { algorithmId, feedId } = req.body;
		const userId = req.session.user_id;
		const existing = await Algorithms.findOne({
			where: { algorithm_id: algorithmId }
		});
		if (!existing) {
			return res.status(400).json({ success: false, message: 'Algorithm not found.' });
		}
		await FeedAlgorithms.destroy({ where: { algorithm_id: algorithmId, feed_id: feedId, user_id: userId }, transaction });
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
				attributes: ['feed_id'],
				as: 'feed_algorithms',
				model: FeedAlgorithms,
				required: false
			}],
			where: { user_id: userId }
		});
		res.status(200).json({ success: true, algorithms });
	} catch (error) {
		console.log("getting user algorithms error:", error);
		res.status(500).json({ success: false, message: 'Failed to get algorithms.' });
	}
});

router.delete('/remove_algorithm', authenticateCheck, async (req, res) => {
	try {
		const { algorithmId, feedId } = req.body;
		const userId = req.session.user_id;
		const existing = await FeedAlgorithms.findOne({
			where: { algorithm_id: algorithmId, feed_id: feedId, user_id: userId }
		});
		if (!existing) {
			return res.status(400).json({ success: false, message: 'Algorithm not assigned to this feed.' });
		}
		await FeedAlgorithms.destroy({ where: { algorithm_id: algorithmId, feed_id: feedId, user_id: userId } });
		res.status(200).json({ success: true });
	} catch (error) {
		console.error("error removing algorithm:", error);
		res.status(500).json({ success: false, message: 'Failed to remove algorithm.' });
	}
});

export default router;