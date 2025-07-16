import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { Router } from 'express';
import { v4 } from 'uuid';
import { Algorithms, AlgorithmLocations} from './algorithmRelationships.js';
import { Feeds, Users } from '../models/relationships.js';
import sequelize from '../databaseSetup.js';

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
	let transaction //Ensures database is only updated when all processes complete successfully
	try {
		transaction = await sequelize.transaction();
		const {
			algorithmName,
			algorithmDescription,
			chronology,
			contentType,
			customInstruction,
			engagement,
			locationId,
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