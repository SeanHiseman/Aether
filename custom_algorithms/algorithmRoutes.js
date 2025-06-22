import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { v4 } from 'uuid';
import { Algorithms, FeedAlgorithms } from './algorithms.js';
import { Feeds } from '../models/feeds.js';
import { Users } from '../models/users.js';

const router = Router();

router.post('/assign_algorithm', authenticateCheck, async (req, res) => {
	const { feedId, algorithmId } = req.body;
	try {
		const userId = req.userId;
		await FeedAlgorithms.create({ algorithm_id: algorithmId, feed_id: feedId, user_id: userId });
		res.status(200).json({ success: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: 'Failed to assign algorithm.' });
	}
});

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
	const {
		algorithmName,
		algorithmDescription,
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
	} = req.body;
	try {
		const userId = req.userId;
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
		});
		res.status(201).json({ success: true, newAlgorithm });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: 'Failed to create algorithm.' });
	}
});


router.get('/get_user_algorithms', authenticateCheck, async (req, res) => {
	try {
        const userId = req.userId;
		const algorithms = await Algorithms.findAll({
			where: { user_id: userId }
		});
		res.status(200).json({ success: true, algorithms });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Failed to get algorithms.' });
	}
});

export default router;