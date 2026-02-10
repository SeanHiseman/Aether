import { Algorithms, AlgorithmLocations } from './algorithmRelationships.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import Bottleneck from 'bottleneck';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import { decrypt, encrypt } from '../functions/encryptionUtil.js';
import fs from 'fs';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import os from 'os';
import path from 'path';
import { Router } from 'express';
import sequelize from '../databaseSetup.js';
import { v4 } from 'uuid';

const analyser = new ContentAnalyser();
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});
const router = Router();

//Configure multer for voice file uploads
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 25 * 1024 * 1024 //25MB limit for OpenAI Whisper
	}
});

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

function politicalPositionToText(position) {
    if (position <= 0.15) return 'far-left progressive political views';
    if (position <= 0.35) return 'left-leaning liberal political views';
    if (position <= 0.65) return 'centrist moderate political views';
    if (position <= 0.85) return 'right-leaning conservative political views';
    return 'far-right conservative political views';
}

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
                endTime, variety, voteImpact, wordBoost, wordSuppress,
                learningRate, interactionWeights,
                authorDiversity, controversyScore,
                accountSizePreference, sourceDiversity,
                politicalPosition, politicalDisagreement, politicalOpinion
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
                },
                learningRate: typeof learningRate === 'number' ? learningRate : 0.5,
                interactionWeights: interactionWeights || { upvotes: 0.3, comments: 0.25, shares: 0.2, saves: 0.15, viewDuration: 0.1 },
                authorDiversity: typeof authorDiversity === 'number' ? authorDiversity : 0.5,
                controversyScore: typeof controversyScore === 'number' ? controversyScore : 0,
                accountSizePreference: typeof accountSizePreference === 'number' ? accountSizePreference : 0.5,
                sourceDiversity: typeof sourceDiversity === 'number' ? sourceDiversity : 0.5,
                ...(politicalPosition != null ? { politicalPosition } : {}),
                ...(politicalDisagreement != null ? { politicalDisagreement } : {})
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
                const fastJson = algorithm.toJSON();
                fastJson.political_opinion = fastJson.political_opinion_encrypted
                    ? decrypt(fastJson.political_opinion_encrypted) : '';
                delete fastJson.political_opinion_encrypted;
                delete fastJson.political_opinion_embedding;
                return res.status(200).json({
                    success: true,
                    algorithm: {
                        ...fastJson,
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
            //Generate embeddings if words changed (single embedding per word list)
            const finalBoostChanged = !sameWords(finalBoost, prevBoost);
            const finalSuppressChanged = !sameWords(finalSuppress, prevSuppress);
            console.time('embedding_generation');
            //Political opinion
            const trimmedOpinion = politicalOpinion?.trim() || '';
            const encryptedOpinion = trimmedOpinion ? encrypt(trimmedOpinion) : null;
            let needsPoliticalEmbedding = false;
            let politicalEmbeddingText = null;
            if (trimmedOpinion) {
                const existingDecrypted = existingAlgorithm?.political_opinion_encrypted
                    ? decrypt(existingAlgorithm.political_opinion_encrypted)
                    : '';
                if (existingDecrypted !== trimmedOpinion) {
                    needsPoliticalEmbedding = true;
                    politicalEmbeddingText = trimmedOpinion;
                }
            } else if (politicalPosition != null) {
                const prevPosition = prevParsedCode?.politicalPosition;
                if (prevPosition !== politicalPosition || !existingAlgorithm?.political_opinion_embedding) {
                    needsPoliticalEmbedding = true;
                    politicalEmbeddingText = politicalPositionToText(politicalPosition);
                }
            }
            //Generate embeddings sequentially per list, but run lists in parallel
            const generateWordEmbeddings = async (words) => {
                const results = [];
                for (const word of words) {
                    results.push(await analyser.generateEmbedding(word));
                }
                return results;
            };
            const [boostEmbedding, suppressEmbedding, politicalOpinionEmbedding] = await Promise.all([
                finalBoost.length > 0 && finalBoostChanged
                    ? generateWordEmbeddings(finalBoost)
                    : Promise.resolve(existingAlgorithm && !finalBoostChanged ? existingAlgorithm.boost_embedding : null),
                finalSuppress.length > 0 && finalSuppressChanged
                    ? generateWordEmbeddings(finalSuppress)
                    : Promise.resolve(existingAlgorithm && !finalSuppressChanged ? existingAlgorithm.suppress_embedding : null),
                needsPoliticalEmbedding
                    ? analyser.generateEmbedding(politicalEmbeddingText)
                    : Promise.resolve(existingAlgorithm?.political_opinion_embedding || null)
            ]);
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
                        suppress_embedding: suppressEmbedding,
                        political_opinion_encrypted: encryptedOpinion,
                        political_opinion_embedding: politicalOpinionEmbedding
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
                        suppress_embedding: suppressEmbedding,
                        political_opinion_encrypted: encryptedOpinion,
                        political_opinion_embedding: politicalOpinionEmbedding
                    },
                    { transaction }
                );
            }
            await transaction.commit();
            console.timeEnd('create_algorithm_total');
            const savedJson = algorithm.toJSON();
            savedJson.political_opinion = savedJson.political_opinion_encrypted
                ? decrypt(savedJson.political_opinion_encrypted) : '';
            delete savedJson.political_opinion_encrypted;
            delete savedJson.political_opinion_embedding;
            res.status(201).json({
                success: true,
                algorithm: {
                    ...savedJson,
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
		const decryptedAlgorithms = algorithms.map(alg => {
			const json = alg.toJSON();
			json.political_opinion = json.political_opinion_encrypted
				? decrypt(json.political_opinion_encrypted)
				: '';
			delete json.political_opinion_encrypted;
			delete json.political_opinion_embedding;
			return json;
		});
		res.status(200).json({ success: true, algorithms: decryptedAlgorithms });
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

router.post('/transcribe_voice', authenticateCheck, upload.single('audio'), async (req, res) => {
	let tempFilePath = null;
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'No audio file provided.' });
		}
		//OpenAI Whisper requires a file, so we save the buffer temporarily
		const tempDir = os.tmpdir();
		const fileExtension = path.extname(req.file.originalname) || '.webm';
		tempFilePath = path.join(tempDir, `${v4()}${fileExtension}`);
		//Write buffer to temporary file
		await fs.promises.writeFile(tempFilePath, req.file.buffer);
		//Convert to a File object compatible with older Node versions
		const fileBuffer = await fs.promises.readFile(tempFilePath);
		const audioFile = await toFile(fileBuffer, `audio${fileExtension}`);
		//Transcribe using OpenAI Whisper
		const transcription = await openai.audio.transcriptions.create({ //Autodetects language
			file: audioFile,
			model: 'whisper-1',
			response_format: 'text'
		});
		res.status(200).json({ success: true, transcription: transcription });
	} catch (error) {
		console.error(new Date().toISOString(), '/transcribe_voice error:', error);
		//Handle specific OpenAI errors
		if (error.code === 'invalid_file_format') {
			return res.status(400).json({
				success: false,
				message: 'Invalid audio format. Please use a supported format.'
			});
		}
		res.status(500).json({ success: false, message: 'Failed to transcribe audio. Please try again.' });
	} finally {
		//Clean up temporary file
		if (tempFilePath) {
			try {
				await fs.promises.unlink(tempFilePath);
			} catch (cleanupError) {
				console.error('Failed to delete temp file:', cleanupError);
			}
		}
	}
});

export default router;