import { Algorithms, AlgorithmLocations } from './algorithmRelationships.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import Bottleneck from 'bottleneck';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import OpenAI from 'openai';
import os from 'os';
import { Router } from 'express';
import sequelize from '../databaseSetup.js';
import { v4 } from 'uuid';

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

const embeddingLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 5
});

const endpointLimiter = new Bottleneck({
    maxConcurrent: 2,
    highWater: 10,
    strategy: Bottleneck.strategy.OVERFLOW
});

const generateEmbeddingThrottled = (word) => {
    return embeddingLimiter.schedule(() => analyser.generateEmbedding(word));
};

async function generateEmbeddingsBatched(words, batchSize = 3) {
    const results = [];
    for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(word => generateEmbeddingThrottled(word))
        );
        results.push(...batchResults);
        if (i + batchSize < words.length) {
            await new Promise(resolve => setImmediate(resolve));
        }
    }
    return results;
}

router.post('/create_algorithm', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        //Rate limiting wrapper
        await endpointLimiter.schedule(async () => {
            console.log('create_algorithm: start');
            console.time('create_algorithm_total');
            const { 
                algorithmId, algorithmName, activeDays, chronology, contentType, 
                customInstruction, generateCode, locationId, minWords, 
                maxWords, minVideo, maxVideo, sentiment, startTime, 
                endTime, variety, voteImpact, wordBoost, wordSuppress 
            } = req.body;
            const viewerId = req.session.viewer_id;
            const MAX_WORDS = 50;
			//Put input words into correct format
			const parseAndNormalizeWords = (input) => {
				let words = [];
				if (typeof input === 'string') {
					words = input.split(',');
				} else if (Array.isArray(input)) {
					words = input;
				} else {
					return [];
				}
				const normalized = words
					.map(word => String(word).trim().toLowerCase())
					.filter(word => word.length > 0);
				return [...new Set(normalized)];
			};
			//Remove duplicate workds
			const removeCrossArrayDuplicates = (boostWords, suppressWords) => {
				const boostSet = new Set(boostWords);
				const dedupedSuppress = suppressWords.filter(word => !boostSet.has(word));
				return { boost: boostWords, suppress: dedupedSuppress };
			};
			const parsedWordBoost = parseAndNormalizeWords(wordBoost);
			const parsedWordSuppress = parseAndNormalizeWords(wordSuppress);
			const { boost: dedupedBoost, suppress: dedupedSuppress } = 
				removeCrossArrayDuplicates(parsedWordBoost, parsedWordSuppress);
			const sanitizedWordBoost = dedupedBoost.slice(0, MAX_WORDS);
			const sanitizedWordSuppress = dedupedSuppress.slice(0, MAX_WORDS);

			//Algorithm structure that gets added to the db
            const algorithmJson = {
                chronology,
                contentType,
                variety,
                activeDays: Array.isArray(activeDays)
                    ? activeDays
                    : Object.keys(activeDays || {}).filter(day => activeDays[day]),
                wordLimits: { min: minWords || null, max: maxWords || null },
                videoLimits: { min: minVideo || null, max: maxVideo || null },
                timeLimits: { startTime: startTime || null, endTime: endTime || null },
                scoring: {
                    sentiment,
                    voteImpact,
                    wordBoost: sanitizedWordBoost,
                    wordSuppress: sanitizedWordSuppress
                }
            };

            await new Promise(resolve => setImmediate(resolve));
            //Find existing algorithm
            let existingAlgorithm = null;
            if (algorithmId) {
                existingAlgorithm = await Algorithms.findOne({
                    where: { algorithm_id: algorithmId, viewer_id: viewerId }
                });
            }
            if (!existingAlgorithm) {
                existingAlgorithm = await Algorithms.findOne({
                    where: { algorithm_name: algorithmName, viewer_id: viewerId }
                });
            }
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
            const stringifySorted = obj => JSON.stringify(obj, Object.keys(obj).sort(), 2);
            //Compare state
            let prevInstruction = '';
            let prevParsedCode = null;
            let prevBoost = [];
            let prevSuppress = [];
            if (existingAlgorithm) {
                prevInstruction = existingAlgorithm.custom_instruction || '';
                prevParsedCode = normalizeAlgorithmCode(existingAlgorithm.algorithm_code);
                prevBoost = prevParsedCode?.scoring?.wordBoost || [];
                prevSuppress = prevParsedCode?.scoring?.wordSuppress || [];
            }
            const currentInstruction = customInstruction || '';
            const currentParsedCode = normalizeAlgorithmCode(algorithmJson);
            const sameStructure = prevParsedCode
                ? stringifySorted(prevParsedCode) === stringifySorted(currentParsedCode)
                : false;
            const instructionChanged = prevInstruction !== currentInstruction;
            //Fast path: only name changed
            if (
                existingAlgorithm &&
                algorithmName !== existingAlgorithm.algorithm_name &&
                !instructionChanged &&
                sameStructure
            ) {
                transaction = await sequelize.transaction();
                const algorithm = await existingAlgorithm.update(
                    { algorithm_name: algorithmName },
                    { transaction }
                );
                await transaction.commit();
                console.timeEnd('create_algorithm_total');
                return res.status(200).json({
                    success: true,
                    algorithm: {
                        ...algorithm.toJSON(),
                        algorithm_locations: [{ location_id: locationId }]
                    }
                });
            }
            const needsAiGeneration = generateCode && 
                currentInstruction.trim() !== '' && 
                instructionChanged;
            let algorithmCode;
            let finalBoost = algorithmJson.scoring.wordBoost;
            let finalSuppress = algorithmJson.scoring.wordSuppress;
            if (needsAiGeneration) {
                console.log('create_algorithm: requesting AI code generation');
                const systemPrompt = `
                    You are an expert algorithm creation assistant.
                    Output a single valid JSON object matching the provided schema.
                    Merge form settings with the custom instruction.
                    No text outside the JSON.
                    Use concise, relevant terms for wordBoost and wordSuppress.
                    Limit wordBoost and wordSuppress to maximum 30 items each or less.
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
                        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
                        { role: 'user', content: [{ type: 'input_text', text: userContent }] }
                    ],
                    max_output_tokens: 2000,
                });
                const aiReply = response.output_text;
                const parsed = aiReply.replace(/```json\n|```/g, '').trim();
                const parsedJson = JSON.parse(parsed);
				if (parsedJson.scoring) {
					const aiBoost = parseAndNormalizeWords(parsedJson.scoring.wordBoost || []);
					const aiSuppress = parseAndNormalizeWords(parsedJson.scoring.wordSuppress || []);
					const { boost: dedupedAiBoost, suppress: dedupedAiSuppress } = 
						removeCrossArrayDuplicates(aiBoost, aiSuppress);
					finalBoost = dedupedAiBoost.slice(0, MAX_WORDS);
					finalSuppress = dedupedAiSuppress.slice(0, MAX_WORDS);
					parsedJson.scoring.wordBoost = finalBoost;
					parsedJson.scoring.wordSuppress = finalSuppress;
				}
				algorithmCode = JSON.stringify(parsedJson);
            } else {
                algorithmCode = JSON.stringify(algorithmJson);
            }
            //Generate embeddings if words changed
            const finalBoostChanged = !sameWords(finalBoost, prevBoost);
            const finalSuppressChanged = !sameWords(finalSuppress, prevSuppress);
            let boostEmbedding = null;
            let suppressEmbedding = null;
            console.time('embedding_generation');
            if (finalBoost.length > 0 && finalBoostChanged) {
                console.log(`create_algorithm: generating ${finalBoost.length} boost embeddings`);
                boostEmbedding = await generateEmbeddingsBatched(finalBoost, 3);
            } else if (existingAlgorithm && !finalBoostChanged) {
                boostEmbedding = existingAlgorithm.boost_embedding;
            }
            if (finalSuppress.length > 0 && finalSuppressChanged) {
                console.log(`create_algorithm: generating ${finalSuppress.length} suppress embeddings`);
                suppressEmbedding = await generateEmbeddingsBatched(finalSuppress, 3);
            } else if (existingAlgorithm && !finalSuppressChanged) {
                suppressEmbedding = existingAlgorithm.suppress_embedding;
            }
            console.timeEnd('embedding_generation');
            transaction = await sequelize.transaction();
            let algorithm;
            if (existingAlgorithm) {
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
            console.timeEnd('create_algorithm_total');
            res.status(201).json({
                success: true,
                algorithm: {
                    ...algorithm.toJSON(),
                    algorithm_locations: [{ location_id: locationId }]
                }
            });
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        if (error.message === 'This job has been dropped by Bottleneck') {
            return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.', retryAfter: 10 });
        }
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