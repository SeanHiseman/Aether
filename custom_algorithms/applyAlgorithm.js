import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { DeepFeedContent, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
import { ExternalPosts, ExternalPostsAccess } from "../models/content.js";
import { FEED_CONFIG, formatExternalPost, processAccount } from "../routes/socialConnect.js";
import { IntermixArrays } from "../functions/intermixArrays.js";
import { Op } from 'sequelize';
import Sequelize, { QueryTypes } from 'sequelize';
import sequelize from "../databaseSetup.js";

//Properties that the frontend does not need to receive
const excludedAttrs = [
	'rank_hotness',
	'rank_updated_at',
    'text_body',
    'text_length',
    'word_count',
    'video_length',
    'sentence_count',
    'has_images',
    'has_videos',
    'has_interactive',
    'has_text',
    'image_count',
    'video_count',
    'sentiment_score',
    'language',
    'tokens',
    'embeddings',
	'boost_amount'
];

function stripExcludedAttributes(posts) {
	return posts.map(p => {
		const obj = p.dataValues ? { ...p.dataValues } : { ...p };
		excludedAttrs.forEach(attr => delete obj[attr]);
		return obj;
	});
}

//Pre-normalize embeddings ONCE when loading algorithm
function prepareAlgorithmEmbeddings(algorithmRow) {
    const result = {
        normalizedBoost: [],
        normalizedSuppress: []
    };
    if (algorithmRow?.boost_embedding) {
        let boostVecs = algorithmRow.boost_embedding;
        if (typeof boostVecs === 'string') {
            try { boostVecs = JSON.parse(boostVecs); } catch { boostVecs = []; }
        }
        if (Array.isArray(boostVecs)) {
            result.normalizedBoost = boostVecs
                .filter(bv => Array.isArray(bv) && bv.length > 0)
                .map(bv => {
                    const m = Math.sqrt(bv.reduce((a, b) => a + b * b, 0)) || 1;
                    return bv.map(v => v / m);
                });
        }
    }
    if (algorithmRow?.suppress_embedding) {
        let suppressVecs = algorithmRow.suppress_embedding;
        if (typeof suppressVecs === 'string') {
            try { suppressVecs = JSON.parse(suppressVecs); } catch { suppressVecs = []; }
        }
        if (Array.isArray(suppressVecs)) {
            result.normalizedSuppress = suppressVecs
                .filter(sv => Array.isArray(sv) && sv.length > 0)
                .map(sv => {
                    const m = Math.sqrt(sv.reduce((a, b) => a + b * b, 0)) || 1;
                    return sv.map(v => v / m);
                });
        }
    }
    return result;
}

// Optimized cosine similarity for pre-normalized vectors
function fastCosineSimilarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}

//Computes algorithm score for a single post
function computeAlgorithmScore(post, { algorithmRow, normalizedBoost, normalizedSuppress, voteImpact, sentiment, variety, normalisedRecentEmbeddings, recentUpvotePosts, recentWeights, totalWeight, timeLimits }) {
    //Time of day filtering
    if (timeLimits.startTime && timeLimits.endTime) {
        const createdAt = new Date(post.created_at || post.created_at_remote);
        const postTime = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
        if (postTime < timeLimits.startTime || postTime > timeLimits.endTime) {
            return null;
        }
    }
    let postEmbedding = post.embeddings;
    if (typeof postEmbedding === 'string') {
        try { postEmbedding = JSON.parse(postEmbedding); } catch { postEmbedding = []; }
    }
    if (!Array.isArray(postEmbedding)) postEmbedding = [];
    
    if (postEmbedding.length === 0) {
        return 0; //No embedding = neutral score
    }
    const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
    const normPost = postEmbedding.map(v => v / magPost);
    const expectedLen = normPost.length;
    let algorithmScore = 0;
    //Semantic boost using pre-normalized embeddings
    if (normalizedBoost && normalizedBoost.length > 0) {
        const sims = [];
        for (const bv of normalizedBoost) {
            if (bv.length === expectedLen) {
                sims.push(fastCosineSimilarity(normPost, bv));
            }
        }
        if (sims.length > 0) {
            sims.sort((a, b) => b - a);
            const top = sims.slice(0, 5);
            algorithmScore += top.reduce((a, b) => a + b, 0) * 20;
        }
    }
    //Semantic suppress using pre-normalized embeddings
    if (normalizedSuppress && normalizedSuppress.length > 0) {
        const sims = [];
        for (const sv of normalizedSuppress) {
            if (sv.length === expectedLen) {
                sims.push(fastCosineSimilarity(normPost, sv));
            }
        }
        if (sims.length > 0) {
            sims.sort((a, b) => b - a);
            const top = sims.slice(0, 5);
            algorithmScore -= top.reduce((a, b) => a + b, 0) * 20;
        }
    }
    //Sentiment alignment
    const postSentiment = typeof post.sentiment_score === 'number' ? post.sentiment_score : 0;
    const sentimentDistance = Math.abs(postSentiment - sentiment);
    algorithmScore += (0.5 - sentimentDistance) * 10;
    //Variety scoring using pre-computed weights
    if (normalisedRecentEmbeddings.length > 0 && normPost.length > 0 && totalWeight > 0) {
        let weightedSum = 0;
        for (let i = 0; i < normalisedRecentEmbeddings.length; i++) {
            const vectorEmbedding = normalisedRecentEmbeddings[i];
            if (vectorEmbedding.length === normPost.length) {
                weightedSum += fastCosineSimilarity(normPost, vectorEmbedding) * recentWeights[i];
            }
        }
        const similarityScore = Math.max(0, Math.min(1, weightedSum));
        const targetSimilarity = 0.6 * (1 - variety) + 0.1 * variety;
        const similarityDelta = targetSimilarity - similarityScore;
        algorithmScore += similarityDelta * 30;
    }
    return algorithmScore;
}

//Scores and paginates candidates from native and/or external sources, returns { paginatedIds, scoreMap } where paginatedIds is the slice for the current page
async function scoreAndPaginateCandidates({ nativePostIds = [], externalPostIds = [], algorithmRow, scoringParams, offset, limit }) {
    //Limit candidates to prevent CPU overload
    const MAX_CANDIDATES = 500;
    //Split candidates fairly between native and external posts
    const hasExternal = externalPostIds.length > 0;
    const hasNative = nativePostIds.length > 0;
    let limitedNativeIds, limitedExternalIds;
    if (hasExternal && hasNative) {
        //50/50 split when both are present
        const halfMax = Math.floor(MAX_CANDIDATES / 2);
        limitedNativeIds = nativePostIds.slice(0, halfMax);
        limitedExternalIds = externalPostIds.slice(0, halfMax);
    } else if (hasExternal) {
        //All external if no native
        limitedNativeIds = [];
        limitedExternalIds = externalPostIds.slice(0, MAX_CANDIDATES);
    } else {
        //All native if no external
        limitedNativeIds = nativePostIds.slice(0, MAX_CANDIDATES);
        limitedExternalIds = [];
    }
    //Pre-normalize algorithm embeddings once
    const { normalizedBoost, normalizedSuppress } = prepareAlgorithmEmbeddings(algorithmRow);
    //Pre-compute variety weights once
    const { normalisedRecentEmbeddings, recentUpvotePosts } = scoringParams;
    const now = Date.now();
    const tenDays = 864000000;
    let recentWeights = [];
    let totalWeight = 0;
    if (recentUpvotePosts && recentUpvotePosts.length > 0) {
        recentWeights = recentUpvotePosts.map(p => {
            const age = now - new Date(p.updated_at).getTime();
            return 1 / (1 + age / tenDays);
        });
        totalWeight = recentWeights.reduce((a, b) => a + b, 0) || 1;
        recentWeights = recentWeights.map(w => w / totalWeight);
    }
    //Build optimized params with pre-computed values
    const optimizedParams = { ...scoringParams, normalizedBoost, normalizedSuppress, recentWeights, totalWeight };
    //Fetch post data with embeddings for scoring
    let nativePosts = [];
    if (limitedNativeIds.length) {
        nativePosts = await Posts.findAll({
            where: { post_id: { [Op.in]: limitedNativeIds } },
            attributes: ['post_id', 'embeddings', 'rank_hotness', 'upvotes', 'downvotes', 'views', 'sentiment_score', 'created_at'],
            raw: true
        });
    }
    let externalPosts = [];
    if (limitedExternalIds.length) {
        externalPosts = await ExternalPosts.findAll({
            where: { post_id: { [Op.in]: limitedExternalIds }, content: { [Op.ne]: null } },
            attributes: ['post_id', 'embeddings', 'score', 'sentiment_score', 'created_at_remote'],
            raw: true
        });
    }
    //Compute algorithm scores for all candidates
    const scoredCandidates = [];
    const allCandidates = [
        ...nativePosts.map(p => ({ ...p, isExternal: false })),
        ...externalPosts.map(p => ({ ...p, isExternal: true, created_at: p.created_at_remote }))
    ];
    let nativeScored = 0;
    let externalScored = 0;
    let nativeFiltered = 0;
    let externalFiltered = 0;
    for (const post of allCandidates) {
        const score = computeAlgorithmScore(post, { algorithmRow, ...optimizedParams });
        if (score !== null) {
            scoredCandidates.push({
                post_id: post.post_id,
                algorithmScore: score,
                isExternal: post.isExternal
            });
            if (post.isExternal) externalScored++;
            else nativeScored++;
        } else {
            if (post.isExternal) externalFiltered++;
            else nativeFiltered++;
        }
    }
    //Sort by algorithm score with post_id as tie-breaker
    scoredCandidates.sort((a, b) => {
        if (b.algorithmScore !== a.algorithmScore) return b.algorithmScore - a.algorithmScore;
        return b.post_id.localeCompare(a.post_id);
    });
    //Apply pagination
    const paginatedIds = scoredCandidates.slice(offset, offset + limit);
    const scoreMap = new Map(paginatedIds.map(p => [p.post_id, p]));
    return { paginatedIds, scoreMap, totalCandidates: scoredCandidates.length };
}

//Fetches full post data for paginated IDs and restores algorithm score ordering
async function fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption }) {
	const nativeIdsToFetch = paginatedIds.filter(p => !p.isExternal).map(p => p.post_id);
	const externalIdsToFetch = paginatedIds.filter(p => p.isExternal).map(p => p.post_id);
	let finalNativePosts = [];
	if (nativeIdsToFetch.length) {
		finalNativePosts = await Posts.findAll({
			where: { post_id: { [Op.in]: nativeIdsToFetch } },
			include: includeOptions,
			attributes: attrOption,
			raw: false
		});
	}
	let finalExternalPosts = [];
	if (externalIdsToFetch.length) {
		const rawExternal = await ExternalPosts.findAll({
			where: { post_id: { [Op.in]: externalIdsToFetch }, content: { [Op.ne]: null } },
			raw: true
		});
		finalExternalPosts = rawExternal.map(p => {
			const platformConfig = FEED_CONFIG[p.source];
			return formatExternalPost(p, platformConfig, p.source);
		});
	}
	//Merge and restore algorithm score ordering
	const nativeWithFlag = finalNativePosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
	const externalWithFlag = finalExternalPosts.map(p => ({ ...p, isExternal: true }));
	const allPosts = [...nativeWithFlag, ...externalWithFlag];
	allPosts.sort((a, b) => {
		const scoreA = scoreMap.get(a.post_id)?.algorithmScore || 0;
		const scoreB = scoreMap.get(b.post_id)?.algorithmScore || 0;
		if (scoreB !== scoreA) return scoreB - scoreA;
		return b.post_id.localeCompare(a.post_id);
	});
	return allPosts.map(p => {
		const algScore = scoreMap.get(p.post_id)?.algorithmScore || 0;
		return {
			...p,
			algorithmScore: algScore
			//score remains as the original platform score (likes) for display
		};
	});
}

async function ApplyAlgorithm({ locationId, feedId, followedFeedIds, includeOptions, isGroup = true, isMain, limit = 100, offset, recentUpvotes, viewerId, keyword = '', connectedAccounts = [], userId }) {
	try {
        //Followed feeds are a received as a string
		const followedFeedIdsSafe = (typeof followedFeedIds === "string")
			? followedFeedIds.split(",")
			: (Array.isArray(followedFeedIds) ? followedFeedIds : []);

        //Find if there is an algorithm applied at this location
		let algorithm = {};
		let algorithmLocation = null;
		let algorithmRow = null;
		if (viewerId && locationId) {
			const normLocationId = locationId.replace(/^deep_/, '');
			algorithmLocation = await AlgorithmLocations.findOne({
				where: { location_id: normLocationId, viewer_id: viewerId },
				raw: true
			});
			//console.log("Checking algorithm location for:", { normLocationId, viewerId, found: !!algorithmLocation });
			//For individual external accounts, also check for algorithm on the parent platform
			if (!algorithmLocation && normLocationId.startsWith('external_account_')) {
				const parts = normLocationId.replace('external_account_', '').split('_');
				const platform = parts[0]; //e.g., 'bluesky'
				algorithmLocation = await AlgorithmLocations.findOne({
					where: { location_id: platform, viewer_id: viewerId },
					raw: true
				});
			}
			if (algorithmLocation) {
				algorithmRow = await Algorithms.findOne({
					attributes: ['algorithm_code', 'boost_embedding', 'suppress_embedding'],
					where: { algorithm_id: algorithmLocation.algorithm_id },
					raw: true
				});
				if (algorithmRow) {
                    try {
                        algorithm = JSON.parse(algorithmRow.algorithm_code);
                    } catch (error) {
                        algorithm = {};
                    }
				}
			}
		}

        //Check if algorithm is active today
		let isActiveToday = true;
		if (algorithmLocation) {
			const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            isActiveToday = algorithm.activeDays && algorithm.activeDays.length > 0 ? algorithm.activeDays.map(d => d.toLowerCase()).includes(today) : true;
		}

		const { chronology = 0, contentType = {}, variety = 1, wordLimits = {}, videoLimits = {}, timeLimits = {}, scoring = {} } = algorithm;
		const { sentiment = 0, voteImpact = 1, wordBoost = [], wordSuppress = [] } = scoring;
		const lowVoteImpact = voteImpact < 0.3;
		const highChronology = chronology > 0.7;
        const useChronological = (!isGroup && !algorithmLocation) || (!isActiveToday && !isGroup);
		const useStandardScore = ((!algorithmLocation && isGroup) || (!isActiveToday && isGroup));
		const hasActiveAlgorithm = algorithmLocation && isActiveToday;

        //Decide whether to fetch with all attributes or exclude them up front
		const fetchFullAttributes = !useChronological && !useStandardScore;
		const attrOption = fetchFullAttributes ? undefined : { exclude: excludedAttrs };
		const backendFetchTotal = (useChronological || useStandardScore) ? limit : Math.max(limit, 100);
		const orderMode = (highChronology || lowVoteImpact ? [['created_at', 'DESC']] : [['rank_hotness', 'DESC']]);

        //Collect recent upvoted posts for similarity comparison
		let recentUpvoteIds = [];
		let recentUpvotePosts = [];
		let normalisedRecentEmbeddings = [];
		if (algorithmLocation) {
			if (viewerId && !recentUpvotes) {
				const foundRecentUpvotes = await PostVotes.findAll({
					attributes: ['post_id'],
					where: {
						voter_id: viewerId,
						upvotes: { [Op.gt]: 0 },
						downvotes: { [Op.lte]: 0 }
					},
					order: [['updated_at', 'DESC']],
					limit: limit,
					raw: true
				});
				recentUpvoteIds = foundRecentUpvotes.map(row => row.post_id);
			} else if (recentUpvotes) {
				recentUpvoteIds = recentUpvotes.map(row => row.post_id);
			}
			if (recentUpvoteIds.length > 0) {
				recentUpvotePosts = await Posts.findAll({
					attributes: ['embeddings', 'updated_at'],
					where: { post_id: { [Op.in]: recentUpvoteIds } },
					raw: true
				});
				const recentUpvoteEmbeddings = recentUpvotePosts.map(p => {
					const raw = p.embeddings;
					if (!raw) return null;
					if (typeof raw === 'string') {
						try {
							const parsed = JSON.parse(raw);
							return Array.isArray(parsed) ? parsed : null;
						} catch (error) {
							return null;
						}
					}
					return Array.isArray(raw) ? raw : null;
				}).filter(Boolean);
				normalisedRecentEmbeddings = recentUpvoteEmbeddings.map(vec => {
					const mag = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
					return vec.map(v => v / mag);
				});
			}
		}

		const scoringParams = { voteImpact, sentiment, variety, normalisedRecentEmbeddings, recentUpvotePosts, timeLimits };

		//Algorithm filters for native Posts
		const algorithmFilters = {};
		if (hasActiveAlgorithm) {
			if (contentType.images === false) algorithmFilters.has_images = false;
			if (contentType.videos === false) algorithmFilters.has_videos = false;
			if (contentType.text === false) algorithmFilters.has_text = false;
			if (contentType.interactive === false) algorithmFilters.has_interactive = false;
			if (Number.isFinite(wordLimits.min)) {
				algorithmFilters.word_count = { [Op.gte]: wordLimits.min };
				algorithmFilters.has_text = true;
			}
			if (Number.isFinite(wordLimits.max)) {
				algorithmFilters.word_count = {
					...algorithmFilters.word_count,
					[Op.lte]: wordLimits.max
				};
				algorithmFilters.has_text = true;
			}
			if (Number.isFinite(videoLimits.min)) {
				algorithmFilters.video_length = { [Op.gte]: videoLimits.min };
				algorithmFilters.has_videos = true;
			}
			if (Number.isFinite(videoLimits.max)) {
				algorithmFilters.video_length = {
					...algorithmFilters.video_length,
					[Op.lte]: videoLimits.max
				};
				algorithmFilters.has_videos = true;
			}
		}

		//Algorithm filters for ExternalPosts (SQL string)
		let externalFiltersSQL = '';
		if (hasActiveAlgorithm) {
			const conditions = [];
			if (contentType.images === false) conditions.push('p.has_images = false');
			if (contentType.text === false) conditions.push('p.has_text = false');
			if (Number.isFinite(wordLimits.min)) conditions.push(`(p.has_text = false OR p.word_count >= ${wordLimits.min})`);
			if (Number.isFinite(wordLimits.max)) conditions.push(`(p.has_text = false OR p.word_count <= ${wordLimits.max})`);
			if (conditions.length > 0) {
				externalFiltersSQL = 'AND ' + conditions.join(' AND ');
			}
		}

		const MAX_ALGORITHM_CANDIDATES = 500;

        //Fetch posts according to location
        let posts = [];
        if (locationId === "search" && keyword) {
			if (hasActiveAlgorithm) {
				//Algorithm path: fetch all candidates, score, then paginate
				const nativePostIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						is_private: false,
						[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${Posts.sequelize.escape(keyword)} IN NATURAL LANGUAGE MODE)`)
					},
					order: [['created_at', 'DESC']],
					limit: MAX_ALGORITHM_CANDIDATES, 
					raw: true
				});
				if (!nativePostIds.length) return { posts: [], status: "ok", message: "" };
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					nativePostIds: nativePostIds.map(p => p.post_id),
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				if (!paginatedIds.length) return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				const postIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						is_private: false,
						[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${Posts.sequelize.escape(keyword)} IN NATURAL LANGUAGE MODE)`)
					},
					order: orderMode,
					limit: backendFetchTotal,
					offset,
					raw: true
				});
				if (!postIds.length) return { posts: [], status: "ok", message: "" };
				const orderedIds = postIds.map(p => p.post_id);
				posts = await Posts.findAll({
					where: { post_id: orderedIds },
					include: includeOptions,
					attributes: attrOption,
					raw: false
				});
				const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
				posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
			}
		} else if (locationId === "following") {
			const hasExternalSources = connectedAccounts.length > 0;
			if (hasActiveAlgorithm) {
				//Algorithm path: fetch all candidates, score, then paginate
				const nativePostIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						feed_id: { [Op.in]: followedFeedIdsSafe },
						parent_id: null,
						...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
					},
					order: [['created_at', 'DESC']],
					limit: MAX_ALGORITHM_CANDIDATES,
					raw: true
				});
				let externalPostIds = [];
				if (hasExternalSources) {
					const externalAccesses = await sequelize.query(
						`SELECT p.post_id FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE a.user_id = :userId AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
						ORDER BY p.created_at_remote DESC
						LIMIT :maxCandidates`,
						{ replacements: { userId, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
					);
					if (!externalAccesses.length && offset === 0) {
						await Promise.all(connectedAccounts.map(account =>
							processAccount({
								platform: account.platform,
								user_id: userId,
								access_token: account.access_token,
								instance_url: account.instance_url
							}).catch(() => null)
						));
						const retryAccesses = await sequelize.query(
							`SELECT p.post_id FROM external_posts_access a
							JOIN external_posts p ON p.post_id = a.post_id
							WHERE a.user_id = :userId AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
							ORDER BY p.created_at_remote DESC
							LIMIT :maxCandidates`,
							{ replacements: { userId, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
						);
						externalPostIds = retryAccesses.map(a => a.post_id);
					} else {
						externalPostIds = externalAccesses.map(a => a.post_id);
					}
				}
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					nativePostIds: nativePostIds.map(p => p.post_id),
					externalPostIds,
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				if (!paginatedIds.length) {
					if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
						return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
					}
					return { posts: [], status: "ok", message: "" };
				}
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path with source mixing
				const halfLimit = Math.ceil(backendFetchTotal / 2);
				const halfOffset = Math.floor(offset / 2);
				const postIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						feed_id: { [Op.in]: followedFeedIdsSafe },
						parent_id: null,
						...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
					},
					order: orderMode,
					limit: hasExternalSources ? halfLimit : backendFetchTotal,
					offset: hasExternalSources ? halfOffset : offset,
					raw: true
				});
				const orderedIds = postIds.map(p => p.post_id);
				let localPosts = [];
				if (orderedIds.length) {
					localPosts = await Posts.findAll({
						where: { post_id: orderedIds },
						include: includeOptions,
						attributes: attrOption,
						raw: false
					});
					const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
					localPosts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
				}
				let externalAccesses = [];
				if (hasExternalSources) {
					externalAccesses = await sequelize.query(
						`SELECT p.post_id FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE a.user_id = :userId AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
						ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
						LIMIT :limit OFFSET :offset`,
						{ replacements: { limit: halfLimit, offset: halfOffset, userId }, type: QueryTypes.SELECT }
					);
					if (!externalAccesses.length && offset === 0) {
						await Promise.all(connectedAccounts.map(account =>
							processAccount({
								platform: account.platform,
								user_id: userId,
								access_token: account.access_token,
								instance_url: account.instance_url
							}).catch(() => null)
						));
						externalAccesses = await sequelize.query(
							`SELECT p.post_id FROM external_posts_access a
							JOIN external_posts p ON p.post_id = a.post_id
							WHERE a.user_id = :userId AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
							ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
							LIMIT :limit OFFSET :offset`,
							{ replacements: { limit: halfLimit, offset: halfOffset, userId }, type: QueryTypes.SELECT }
						);
					}
				}
				const unifiedIds = externalAccesses.map(a => a.post_id);
				let externalPosts = [];
				if (unifiedIds.length) {
					externalPosts = await ExternalPosts.findAll({
						where: { post_id: unifiedIds, content: { [Op.ne]: null } },
						raw: true
					});
				}
				const formattedExternal = externalPosts.map(p => formatExternalPost(p, FEED_CONFIG[p.source], p.source));
				const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
				const externalWithFlag = formattedExternal.map(p => ({ ...p, isExternal: true }));
				posts = [...localWithFlag, ...externalWithFlag].slice(0, backendFetchTotal);
			}
		} else if (typeof locationId === 'string' && locationId.startsWith('external_account_')) {
			//console.log("Applying algorithm for external account location:", locationId);
			//Individual external account (e.g., external_account_bluesky_did:plc:xxx)
			const parts = locationId.replace('external_account_', '').split('_');
			const platform = parts[0];
			const accountId = parts.slice(1).join('_'); //Handle DIDs with underscores
			if (hasActiveAlgorithm) {
				//console.log("hasActiveAlgorithm is true");
				//Algorithm path for individual external account
				//Search by both author_did and author (handle) for robustness
				const externalPosts = await ExternalPosts.findAll({
					attributes: ['post_id'],
					where: {
						source: platform,
						[Op.or]: [{ author_did: accountId }, { author: accountId }],
						expired: false,
						content: { [Op.ne]: null }
					},
					order: [['created_at_remote', 'DESC']],
					limit: MAX_ALGORITHM_CANDIDATES,
					raw: true
				});
				const externalPostIds = externalPosts.map(p => p.post_id);
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					externalPostIds,
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				//console.log("scoreAndPaginateCandidates result:", { paginatedIds, scoreMap });
				if (!paginatedIds.length) {
					if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
						return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
					}
					return { posts: [], status: "ok", message: "" };
				}
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				//Search by both author_did and author (handle) for robustnessThe 
				const rawExternal = await ExternalPosts.findAll({
					where: {
						source: platform,
						[Op.or]: [{ author_did: accountId }, { author: accountId }],
						expired: false,
						content: { [Op.ne]: null }
					},
					order: [['created_at_remote', 'DESC']],
					limit: backendFetchTotal,
					offset,
					raw: true
				});
				posts = rawExternal.map(p => ({
					...formatExternalPost(p, FEED_CONFIG[platform], platform),
					isExternal: true
				}));
			}
		} else if (typeof locationId === 'string' && ['reddit','bluesky','mastodon'].includes(locationId)) {
			const platform = locationId;
			if (hasActiveAlgorithm) {
				//Algorithm path for external platform feeds
				let externalPostIds = [];
				if (userId) {
					const accesses = await sequelize.query(
						`SELECT p.post_id FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
						ORDER BY p.created_at_remote DESC
						LIMIT :maxCandidates`,
						{ replacements: { userId, platform, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
					);
					externalPostIds = accesses.map(a => a.post_id);
					if (!externalPostIds.length && connectedAccounts?.length) {
						const account = connectedAccounts.find(a => a.platform === platform);
						if (account) {
							await processAccount({
								platform,
								user_id: userId,
								access_token: account.access_token,
								instance_url: account.instance_url
							}).catch(() => null);
							const retryAccesses = await sequelize.query(
								`SELECT p.post_id FROM external_posts_access a
								JOIN external_posts p ON p.post_id = a.post_id
								WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
								AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
								ORDER BY p.created_at_remote DESC
								LIMIT :maxCandidates`,
								{ replacements: { userId, platform, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
							);
							externalPostIds = retryAccesses.map(a => a.post_id);
						}
					}
				}
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					externalPostIds,
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				if (!paginatedIds.length) return { posts: [], status: "ok", message: "" };
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				let accesses = [];
				if (userId) {
					accesses = await sequelize.query(
						`SELECT p.post_id FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
						ORDER BY (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
						LIMIT :limit OFFSET :offset`,
						{ replacements: { limit: backendFetchTotal, offset, platform, userId }, type: QueryTypes.SELECT }
					);
				}
				if (!accesses.length && connectedAccounts?.length) {
					const account = connectedAccounts.find(a => a.platform === platform);
					if (account) {
						await processAccount({
							platform,
							user_id: userId,
							access_token: account.access_token,
							instance_url: account.instance_url
						}).catch(() => null);
						accesses = await sequelize.query(
							`SELECT p.post_id FROM external_posts_access a
							JOIN external_posts p ON p.post_id = a.post_id
							WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
							ORDER BY (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
							LIMIT :limit OFFSET :offset`,
							{ replacements: { limit: backendFetchTotal, offset, platform, userId }, type: QueryTypes.SELECT }
						);
					}
				}
				const unifiedIds = accesses.map(a => a.post_id).filter(Boolean);
				let externalPosts = [];
				if (unifiedIds.length) {
					externalPosts = await ExternalPosts.findAll({
						where: { post_id: unifiedIds, source: platform, content: { [Op.ne]: null } },
						raw: true
					});
				}
				posts = externalPosts.map(p => formatExternalPost(p, FEED_CONFIG[platform], p.source));
			}
        } else if (locationId === "explore") {
			if (hasActiveAlgorithm) {
				//Algorithm path with external posts
				const nativePostIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						parent_id: null,
						...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {}),
						is_private: false
					},
					order: [['created_at', 'DESC']],
					limit: MAX_ALGORITHM_CANDIDATES,
					raw: true
				});
				//Fetch hottest external posts from all platforms (same for all users)
				//Use 30 day window for explore feed to ensure content availability
				const externalPostsQuery = await sequelize.query(
					`SELECT p.post_id FROM external_posts p
					WHERE p.source IN ('reddit', 'bluesky', 'mastodon') AND p.expired = false
					AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${externalFiltersSQL}
					ORDER BY (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
					LIMIT :maxCandidates`,
					{ replacements: { maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
				);
				const externalPostIds = externalPostsQuery.map(a => a.post_id);
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					nativePostIds: nativePostIds.map(p => p.post_id),
					externalPostIds,
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				if (!paginatedIds.length) {
					if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
						return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
					}
					return { posts: [], status: "ok", message: "" };
				}
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path with mixed native and external posts
				const halfLimit = Math.ceil(backendFetchTotal / 2);
				const halfOffset = Math.floor(offset / 2);
				const postIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						parent_id: null,
						...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {}),
						is_private: false
					},
					order: orderMode,
					limit: halfLimit,
					offset: halfOffset,
					raw: true
				});
				const orderedIds = postIds.map(p => p.post_id);
				let localPosts = [];
				if (orderedIds.length) {
					localPosts = await Posts.findAll({
						where: { post_id: orderedIds },
						include: includeOptions,
						attributes: attrOption,
						raw: false
					});
					const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
					localPosts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
				}
				//Fetch hottest external posts from all platforms (same for all users)
				//Use 30 day window for explore feed to ensure content availability
				const externalAccesses = await sequelize.query(
					`SELECT p.post_id FROM external_posts p
					WHERE p.source IN ('reddit', 'bluesky', 'mastodon') AND p.expired = false
					AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${externalFiltersSQL}
					ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
					LIMIT :limit OFFSET :offset`,
					{ replacements: { limit: halfLimit, offset: halfOffset }, type: QueryTypes.SELECT }
				);
				const unifiedIds = externalAccesses.map(a => a.post_id);
				let externalPosts = [];
				if (unifiedIds.length) {
					externalPosts = await ExternalPosts.findAll({
						where: { post_id: unifiedIds, content: { [Op.ne]: null } },
						raw: true
					});
				}
				const formattedExternal = externalPosts.map(p => formatExternalPost(p, FEED_CONFIG[p.source], p.source));
				const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
				const externalWithFlag = formattedExternal.map(p => ({ ...p, isExternal: true }));
				posts = IntermixArrays(localWithFlag, externalWithFlag).slice(0, backendFetchTotal);
			}
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
            const deepFeedId = locationId.replace(/^deep_/, '');
            const contents = await DeepFeedContent.findAll({
                where: { deep_feed_id: deepFeedId },
                attributes: ['feed_id', 'external_did'],
                raw: true
            });
            const allFeedIds = contents.map(c => c.feed_id).filter(Boolean);
            const externalDids = contents.map(c => c.external_did).filter(Boolean);
            const hasExternalAccounts = externalDids.length > 0;
			if (hasActiveAlgorithm) {
				//Algorithm path
				let nativePostIds = [];
				if (allFeedIds.length > 0) {
					nativePostIds = await Posts.findAll({
						attributes: ['post_id'],
						where: {
							...algorithmFilters,
							feed_id: { [Op.in]: allFeedIds },
							parent_id: null,
							...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
						},
						order: [['created_at', 'DESC']],
						limit: MAX_ALGORITHM_CANDIDATES,
						raw: true
					});
				}
				//Fetch external posts from Bluesky accounts in the deep feed
				let externalPostIds = [];
				if (hasExternalAccounts) {
					const externalPosts = await ExternalPosts.findAll({
						attributes: ['post_id'],
						where: {
							source: 'bluesky',
							author_did: { [Op.in]: externalDids },
							expired: false,
							content: { [Op.ne]: null }
						},
						order: [['created_at_remote', 'DESC']],
						raw: true
					});
					externalPostIds = externalPosts.map(p => p.post_id);
				}
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					nativePostIds: nativePostIds.map(p => p.post_id),
					externalPostIds,
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				if (!paginatedIds.length) {
					if (Object.keys(algorithmFilters).length > 0) {
						return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
					}
					return { posts: [], status: "ok", message: "" };
				}
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path with mixed native and external posts
				const halfLimit = hasExternalAccounts ? Math.ceil(backendFetchTotal / 2) : backendFetchTotal;
				const halfOffset = hasExternalAccounts ? Math.floor(offset / 2) : offset;
				let localPosts = [];
				if (allFeedIds.length > 0) {
					const postIds = await Posts.findAll({
						attributes: ['post_id'],
						where: {
							...algorithmFilters,
							feed_id: { [Op.in]: allFeedIds },
							parent_id: null,
							...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
						},
						order: orderMode,
						limit: halfLimit,
						offset: halfOffset,
						raw: true
					});
					const orderedIds = postIds.map(p => p.post_id);
					if (orderedIds.length) {
						localPosts = await Posts.findAll({
							where: { post_id: orderedIds },
							include: includeOptions,
							attributes: attrOption,
							raw: false
						});
						const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
						localPosts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
					}
				}
				//Fetch external posts from Bluesky accounts
				let externalPosts = [];
				if (hasExternalAccounts) {
					const rawExternal = await ExternalPosts.findAll({
						where: {
							source: 'bluesky',
							author_did: { [Op.in]: externalDids },
							expired: false,
							content: { [Op.ne]: null }
						},
						order: [['created_at_remote', 'DESC']],
						limit: halfLimit,
						offset: halfOffset,
						raw: true
					});
					externalPosts = rawExternal.map(p => formatExternalPost(p, FEED_CONFIG.bluesky, 'bluesky'));
				}
				const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
				const externalWithFlag = externalPosts.map(p => ({ ...p, isExternal: true }));
				posts = IntermixArrays(localWithFlag, externalWithFlag).slice(0, backendFetchTotal);
			}
        } else {
            //Default: channels and main feeds
            const channelOrderMode = useChronological ? [['created_at', 'DESC']] : [['rank_hotness', 'DESC']];
			const whereClause = {
				...algorithmFilters,
				...(!isMain && locationId ? { channel_id: locationId } : {}),
				...(isMain && feedId && !isGroup ? { poster_id: feedId } : {}),
				...(isMain && isGroup ? { feed_id: feedId } : {}),
				...(isMain ? {
					[Op.or]: [
						{ is_private: false },
						...(feedId ? [{ feed_id: feedId }] : [])
					]
				} : {}),
				parent_id: null,
			};
			if (hasActiveAlgorithm) {
				//Algorithm path
				const nativePostIds = await Posts.findAll({
					attributes: ['post_id'],
					where: whereClause,
					order: [['created_at', 'DESC']],
					limit: MAX_ALGORITHM_CANDIDATES,
					raw: true
				});
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					nativePostIds: nativePostIds.map(p => p.post_id),
					algorithmRow,
					scoringParams,
					offset,
					limit
				});
				if (!paginatedIds.length) {
					if (Object.keys(algorithmFilters).length > 0) {
						return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
					}
					return { posts: [], status: "ok", message: "" };
				}
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				const postIds = await Posts.findAll({
					attributes: ['post_id'],
					where: whereClause,
					order: channelOrderMode,
					limit: backendFetchTotal,
					offset,
					raw: true
				});
				const orderedIds = postIds.map(p => p.post_id);
				posts = await Posts.findAll({
					where: { post_id: orderedIds },
					include: includeOptions,
					attributes: attrOption,
					raw: false
				});
				const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
				posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
			}
        }

        if (!posts.length) {
			if (hasActiveAlgorithm && (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL)) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}

		//Check if posts already have algorithmScore (from algorithm path)
		const postsAlreadyScored = posts.length > 0 && typeof posts[0].algorithmScore === 'number';

		//For non-algorithm paths that still need standard score processing
		if (!postsAlreadyScored && (useChronological || useStandardScore)) {
			//Intermix for "following" feed before returning
			if (locationId === "following" && posts.some(p => p.isExternal === true) && posts.some(p => p.isExternal === false)) {
				const nativePosts = posts.filter(p => p.isExternal === false);
				const externalPosts = posts.filter(p => p.isExternal === true);
				posts = IntermixArrays(nativePosts, externalPosts);
			}
			const ids = posts.map(p => p.post_id);
			const [userVotes, savedRows] = viewerId
				? await Promise.all([
					PostVotes.findAll({
						attributes: ['post_id', 'upvotes', 'downvotes'],
						where: { post_id: { [Op.in]: ids }, voter_id: viewerId },
						raw: true
					}),
					SavedPosts.findAll({
						attributes: ['post_id'],
						where: { post_id: { [Op.in]: ids }, saver_id: viewerId },
						raw: true
					})
				])
				: [[], []];
			const voteMap = new Map(
				userVotes.map(v => [v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }])
			);
			const savedSet = new Set(savedRows.map(s => s.post_id));
			return {
				posts: stripExcludedAttributes(
					posts.map(p => ({
						...(p.dataValues || p),
						...(voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false }),
						is_saved: savedSet.has(p.post_id)
					}))
				),
				status: "ok"
			};
		}
		const finalIds = posts.map(p => p.post_id);
		const [userVotes, savedRows] = viewerId
			? await Promise.all([
				PostVotes.findAll({
					attributes: ['post_id', 'upvotes', 'downvotes'],
					where: { post_id: { [Op.in]: finalIds }, voter_id: viewerId },
					raw: true
				}),
				SavedPosts.findAll({
					attributes: ['post_id'],
					where: { post_id: { [Op.in]: finalIds }, saver_id: viewerId },
					raw: true
				})
			])
			: [[], []];
		const voteMap = new Map(userVotes.map(v => [
			v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }
		]));
		const savedSet = new Set(savedRows.map(s => s.post_id));
		const postsWithVotes = posts.map(p => ({
			...(p.dataValues || p),
			...(voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false }),
			is_saved: savedSet.has(p.post_id)
		}));
		return { posts: stripExcludedAttributes(postsWithVotes), status: "ok", message: "" };
	} catch (error) {
		console.error(new Date().toISOString(), 'Error in ApplyAlgorithm:', error);
		return { posts: [], status: "error", message: "" };
	}
}

export { ApplyAlgorithm };