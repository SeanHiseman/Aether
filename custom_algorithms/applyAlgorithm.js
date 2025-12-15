import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { DeepFeedContent, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
import { ExternalPosts, ExternalPostsAccess } from "../models/content.js";
import { FEED_CONFIG, formatExternalPost, processAccount } from "../routes/socialConnect.js";
import { Op } from 'sequelize';
import Sequelize, { QueryTypes } from 'sequelize';
import sequelize from "../databaseSetup.js";

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
    'has_external_posts',
    'has_embedded_websites',
    'has_text',
    'image_count',
    'video_count',
    'sentiment_score',
    'language',
    'tokens',
    'embeddings'
];

function stripExcludedAttributes(posts) {
	return posts.map(p => {
		const obj = p.dataValues ? { ...p.dataValues } : { ...p };
		excludedAttrs.forEach(attr => delete obj[attr]);
		return obj;
	});
}

async function ApplyAlgorithm({ locationId, feedId, followedFeedIds, includeOptions, isGroup = true, isMain, limit = 100, offset, recentUpvotes, viewerId, keyword = '', connectedAccounts = [], userId }) {
	//console.log("getting posts in applyAlgorithms at:", new Date().toISOString());
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
		//let isActiveToday = false;
		let isActiveToday = true;
		//if (algorithmLocation) {
			//const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            //isActiveToday = algorithm.activeDays && algorithm.activeDays.length > 0 ? algorithm.activeDays.map(d => d.toLowerCase()).includes(today) : true;
		//}

		const getOldest = algorithm.chronology === -1; //Get oldest posts
        const useChronological = (!isGroup && !algorithmLocation) || (!isActiveToday && !isGroup) || (algorithm.chronology === 1); //User feeds without active algorithms or 1 chronology should be in time order only
		const useStandardScore = (!algorithmLocation && isGroup) || (!isActiveToday && isGroup);

        //Decide whether to fetch with all attributes or exclude them up front
		const fetchFullAttributes = !useChronological && !useStandardScore;

        //Collect recent upvoted posts for similarity comparison from local storage or database
		let recentUpvoteIds = [];
		let recentUpvoteEmbeddings = [];
		let recentUpvotePosts = [];
		let normalisedRecentEmbeddings = [];
		if (algorithmLocation) { //Only need recent votes if there's an algorithm
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
				recentUpvoteEmbeddings = recentUpvotePosts.map(p => {
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
			}
			normalisedRecentEmbeddings = recentUpvoteEmbeddings.map(vec => {
				const mag = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
				return vec.map(v => v / mag);
			});
		}

        //Fetch posts according to location
        let posts = [];
        const attrOption = fetchFullAttributes ? undefined : { exclude: excludedAttrs };

		const orderMode = getOldest
			? [['created_at', 'ASC']]
			: (useChronological ? [['created_at', 'DESC']] : [['rank_hotness', 'DESC']]);
        if (locationId === "search" && keyword) {
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
				where: { 
					is_private: false,
					[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${Posts.sequelize.escape(keyword)} IN NATURAL LANGUAGE MODE)`) 
				},
                order: orderMode,
                limit: limit,
                offset,
                raw: true
            });
            if (!postIds.length) return [];
            const orderedIds = postIds.map(p => p.post_id);
            posts = await Posts.findAll({
                where: { post_id: orderedIds },
                include: includeOptions,
                attributes: attrOption,
                raw: false
            });
            const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
			posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
		} else if (locationId === "following") {
			const enabledSources = [];
			if (connectedAccounts.find(a => a.platform === 'reddit')) enabledSources.push('reddit');
			if (connectedAccounts.find(a => a.platform === 'bluesky')) enabledSources.push('bluesky');
			if (connectedAccounts.find(a => a.platform === 'mastodon')) enabledSources.push('mastodon');
			const totalSources = 1 + enabledSources.length;
			const postsPerSource = Math.floor((limit * 0.5) / totalSources);
			//Fetch local posts
			const postIds = await Posts.findAll({
				attributes: ['post_id'],
				where: {
					feed_id: { [Op.in]: followedFeedIdsSafe },
					parent_id: null,
					...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
				},
				order: orderMode,
				limit: postsPerSource,
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
			//Fetch external posts only if user has connected accounts
			let externalAccesses = [];
			if (connectedAccounts.length > 0) {
				externalAccesses = await sequelize.query(
					`
					SELECT
						p.post_id
					FROM external_posts_access a
					JOIN external_posts p ON p.post_id = a.post_id
					WHERE
						a.user_id = :userId
						AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
					ORDER BY
						(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
					LIMIT :limit OFFSET :offset
					`,
					{
						replacements: { limit: postsPerSource, offset, userId },
						type: QueryTypes.SELECT
					}
				);
				if (!externalAccesses.length && offset === 0) {
					await Promise.all(
						connectedAccounts.map(account =>
							processAccount({
								platform: account.platform,
								user_id: userId,
								access_token: account.access_token,
								instance_url: account.instance_url
							}).catch(() => null)
						)
					);
					externalAccesses = await sequelize.query(
						`
						SELECT
							p.post_id
						FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE
							a.user_id = :userId
							AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
						ORDER BY
							(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
						LIMIT :limit OFFSET :offset
						`,
						{
							replacements: { limit: postsPerSource, offset, userId },
							type: QueryTypes.SELECT
						}
					);
				}
			}
			const unifiedIds = externalAccesses.map(a => a.post_id);
			let externalPosts = [];
			if (unifiedIds.length) {
				externalPosts = await ExternalPosts.findAll({
					where: { post_id: unifiedIds },
					raw: true
				});
			}
			const formattedExternal = externalPosts.map(p => {
				const platformConfig = FEED_CONFIG[p.source];
				return formatExternalPost(p, platformConfig, p.source);
			});
			posts = [
				...posts.map(p => ({ ...(p.dataValues || p), isExternal: false })),
				...formattedExternal
			];
		} else if (typeof locationId === 'string' && ['reddit','bluesky','mastodon'].includes(locationId)) {
			const platform = locationId;
			//console.log("inside applyAlgorithm getting posts for:", platform);
			let accesses = [];
			//console.log("userId:", userId);
			if (userId) {
				accesses = await sequelize.query(
					`
					SELECT
						p.post_id
					FROM external_posts_access a
					JOIN external_posts p ON p.post_id = a.post_id
					WHERE
						a.user_id = :userId
						AND a.source = :platform
						AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
					ORDER BY
						(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
					LIMIT :limit OFFSET :offset
					`,
					{
						replacements: { limit, offset, platform, userId },
						type: QueryTypes.SELECT
					}
				);
			}
			//console.log("accesses found:", accesses.length);
			if (!accesses.length && connectedAccounts && connectedAccounts.length) {
				const account = connectedAccounts.find(a => a.platform === platform);
				//console.log("processing account for platform:", platform, account ? "found" : "not found");
				if (account) {
					await processAccount({
						platform,
						user_id: userId,
						access_token: account.access_token,
						instance_url: account.instance_url
					}).catch(() => null);
					accesses = await sequelize.query(
						`
						SELECT
							p.post_id
						FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE
							a.user_id = :userId
							AND a.source = :platform
							AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
						ORDER BY
							(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
						LIMIT :limit OFFSET :offset
						`,
						{
							replacements: { limit, offset, platform, userId },
							type: QueryTypes.SELECT
						}
					);
				}
			}
			const unifiedIds = accesses.map(a => a.post_id).filter(Boolean);
			//console.log("unifiedIds found:", unifiedIds.length);
			let externalPosts = [];
			if (unifiedIds.length) {
				externalPosts = await ExternalPosts.findAll({
					where: { post_id: unifiedIds, source: platform },
					raw: true
				});
			}
			const formattedExternal = externalPosts.map(p => {
				const platformConfig = FEED_CONFIG[platform];
				return formatExternalPost(p, platformConfig, p.source);
			});
			posts = formattedExternal;
			//console.log("externalPosts found:", posts.length);
		} else if (locationId === "explore") {
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    feed_id: { [Op.notIn]: followedFeedIdsSafe },
                    parent_id: null,
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {}),
					is_private: false
                },
                order: orderMode,
                limit: limit,
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
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
            const deepFeedId = locationId.replace(/^deep_/, '');
            const contents = await DeepFeedContent.findAll({
                where: { deep_feed_id: deepFeedId },
                attributes: ['feed_id'],
                raw: true
            });
            const allFeedIds = contents.map(c => c.feed_id);
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    feed_id: { [Op.in]: allFeedIds },
                    parent_id: null,
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
                },
                order: orderMode,
                limit: limit,
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
        } else {
			//Non-group channels are chronological by default
			const channelOrderMode =
				(getOldest)
					? [['created_at', 'ASC']]
					: ((useChronological && !getOldest)
						? [['created_at', 'DESC']]
						: [['rank_hotness', 'DESC']]);
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    ...(isMain !== true && locationId ? { channel_id: locationId } : {}),
                    feed_id: feedId,
                    parent_id: null,
                },
                order: channelOrderMode,
                limit: limit,
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
        if (!posts.length) return [];

		//No algorithm to be applied
		if (getOldest || useChronological || useStandardScore) {
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
			return stripExcludedAttributes(
				posts.map(p => ({
					...(p.dataValues || p),
					...(voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false }),
					is_saved: savedSet.has(p.post_id)
				}))
			);
		}

        //Filter out posts, then apply scoring
		let finalPosts = [];
        const { chronology = 1, contentType = {}, variety = 1, textLimits = {}, videoLimits = {}, timeLimits = {}, dateLimits = {}, scoring = {} } = algorithm;
		const { sentiment = 0, voteImpact = 1 } = scoring;
		//console.log("algorithm:", algorithm);
		//console.log("scoring:", scoring);
		//console.log("posts:", posts);
		//console.log("algorithm:", algorithm);
		//console.log("posts length:", posts.length);

		//Predefined variables for use in scoring
		const now = Date.now();
		const tenDays = 864000000;
		let postEmbedding = [];
		try {
			const logStart = Date.now();
			//console.log("posts.length:", posts.length);
			for (const post of posts) {
				postEmbedding = post.embeddings;
				//Content type filtering
				//if (contentType.images === false && post.has_images) continue;
				//if (contentType.videos === false && post.has_videos) continue;
				//if (contentType.text === false && post.has_text) continue;
				//if (contentType.interactive === false && post.has_interactive) continue;
				//if (contentType.embeddedWebsites === false && post.has_embedded_websites) continue;
				//if (contentType.externalPosts === false && post.has_external_posts) continue;
				//Text length filtering
				//if (textLimits.min && post.text_length < textLimits.min) continue;
				//if (textLimits.max && post.text_length > textLimits.max) continue;
				//Video length filtering
				//if (videoLimits.min && post.video_length < videoLimits.min) continue;
				//if (videoLimits.max && post.video_length > videoLimits.max) continue;
				//Time of day filtering
				//if (timeLimits.startTime && timeLimits.endTime) {
				//	const createdAt = new Date(post.created_at || post.created_at_remote);
				//	const postTime = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
				//	if (postTime < timeLimits.startTime || postTime > timeLimits.endTime) continue;
				//}
				//Date range filtering
				//if (dateLimits.from && new Date(post.created_at || post.created_at_remote) < new Date(dateLimits.from)) continue;
				//if (dateLimits.to && new Date(post.created_at || post.created_at_remote) > new Date(dateLimits.to)) continue;
				let algorithmScore = 0;
				const baseHotness = post.rank_hotness;
				algorithmScore = baseHotness;
				//algorithmScore += (chronology ?? 1) * baseHotness;
				
				//Vote quality * engagement ratio (distinct from hotness)
				//const totalVotes = (post.upvotes || 0) + (post.downvotes || 0);
				//const qualityRatio = totalVotes > 0 ? (post.upvotes || 0) / totalVotes : 0.5;
				//const engagementRatio = (post.views || 0) > 0 ? totalVotes / post.views : 0;
				//algorithmScore += voteImpact * ((qualityRatio * 0.7) + (engagementRatio * 0.3));

				//Semantic boost/suppress using word embeddings
				//console.log("-----------", post.text_body);
				if ((algorithmRow?.boost_embedding || algorithmRow?.suppress_embedding)) {
					const raw = postEmbedding;
					if (typeof raw === 'string') {
						try {
							postEmbedding = JSON.parse(raw);
						} catch {
							postEmbedding = [];
						}
					}
					if (!Array.isArray(postEmbedding)) {
						postEmbedding = [];
					}
					const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
					const normPost = postEmbedding.map(v => v / magPost);
					let semanticBoost = 0;
					let semanticSuppress = 0;
					try {
						const algoJson = JSON.parse(algorithmRow.algorithm_code);
						boostWords = algoJson.scoring?.wordBoost || [];
						suppressWords = algoJson.scoring?.wordSuppress || [];
					} catch {}
					if (algorithmRow.boost_embedding) {
						let boostVecs = algorithmRow.boost_embedding;
						if (typeof boostVecs === 'string') {
							try {
								boostVecs = JSON.parse(boostVecs);
							} catch {
								boostVecs = [];
							}
						}
						if (!Array.isArray(boostVecs)) {
							boostVecs = [];
						}
						if (Array.isArray(boostVecs) && boostVecs.length) {
							const sims = boostVecs.map((bv, i) => {
								//const word = boostWords[i] || `keyword${i}`;
								if (!bv || bv.length !== normPost.length) {
									return 0;
								}
								const sim = CosineSimilarity(normPost, bv);
								//console.log(`Boost "${word}" similarity:`, sim);
								return sim;
							});
							const top = sims.sort((a, b) => b - a).slice(0, 5);
							semanticBoost = top.reduce((a, b) => a + b, 0);
							//console.log("Top boost sims:", top, "semanticBoost:", semanticBoost);
						}
					}
					if (algorithmRow.suppress_embedding) {
						let suppressVecs = algorithmRow.suppress_embedding;
						if (typeof suppressVecs === 'string') {
							try {
								suppressVecs = JSON.parse(suppressVecs);
							} catch {
								suppressVecs = [];
							}
						}
						if (!Array.isArray(suppressVecs)) {
							suppressVecs = [];
						}
						if (Array.isArray(suppressVecs) && suppressVecs.length) {
							const sims = suppressVecs.map((sv, i) => {
								//const word = suppressWords[i] || `keyword${i}`;
								if (!sv || sv.length !== normPost.length) {
									return 0;
								}
								const sim = CosineSimilarity(normPost, sv);
								//console.log(`Suppress "${word}" similarity:`, sim);
								return sim;
							});
							const top = sims.sort((a, b) => b - a).slice(0, 5);
							semanticSuppress = top.reduce((a, b) => a + b, 0);
							//console.log("Top suppress sims:", top, "semanticSuppress:", semanticSuppress);
						}
					}
					//console.log("score before: semantics", algorithmScore);
					algorithmScore += (semanticBoost * 20) - (semanticSuppress * 20);
					//console.log("score after semantics:", algorithmScore);
				}

				//Sentiment alignment
				const sentimentDistance = Math.abs(post.sentiment_score - sentiment);
				//console.log("post sentiment:", post.sentiment_score);
				//console.log("algorithm sentiment:", sentiment)
				//console.log("sentiment distance:", sentimentDistance);
				//console.log("score before sentimentDistance:", algorithmScore);
				algorithmScore += (0.5 - sentimentDistance) * 10;
				//console.log("score after sentimentDistance:", algorithmScore);

				//Variety scoring (cosine similarity against recent upvoted embeddings)
				let similarityScore = 0;
				if (normalisedRecentEmbeddings.length > 0) {
					const weights = recentUpvotePosts.map(p => {
						const age = now - new Date(p.updated_at).getTime();
						return 1 / (1 + age / tenDays); 
					});
					const totalWeight = weights.reduce((a, b) => a + b, 0) || 1; //Higher weights for more recent upvotes
					let weightedSum = 0;
					for (let i = 0; i < normalisedRecentEmbeddings.length; i++) {
						const vectorEmbedding = normalisedRecentEmbeddings[i];
						if (vectorEmbedding.length === postEmbedding.length) {
							const weight = weights[i] / totalWeight;
							const similarity = CosineSimilarity(postEmbedding, vectorEmbedding);
							//console.log("similarity:", similarity);
							weightedSum += similarity * weight;
							//console.log("weightedSum:", weightedSum);
						}
					}
					similarityScore = Math.max(0, Math.min(1, weightedSum)); //Clamp between 0 and 1
				}
				//console.log("score before similarity:", algorithmScore);
				const targetSimilarity = 0.6 * (1 - variety) + 0.1 * variety;
				const similarityDelta = targetSimilarity - similarityScore;
				const scoreAdjustment = similarityDelta * 30; //scaling factor
				algorithmScore += scoreAdjustment;
				//console.log("score after similarity:", algorithmScore);
				finalPosts.push({ ...post.dataValues || post, algorithmScore });
			}
			//console.log("finalPosts:", finalPosts);
			//console.log("finalPosts length:", finalPosts.length);
			const logEnd = Date.now();
			//console.log("post processing time ms:", logEnd - logStart);
		} catch (error) {
			console.error(new Date().toISOString(), "error applying algorithm to posts:", error);
			finalPosts = posts; //Return initial post batch if issue applying algorithm
		}
		if (!finalPosts.length) return [];
        finalPosts.sort((a, b) => b.algorithmScore - a.algorithmScore); //Sort posts by score
        const paginatedFinalPosts = finalPosts.slice(0, limit);
        const finalIds = paginatedFinalPosts.map(p => p.post_id);
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
        const postsWithVotes = paginatedFinalPosts.map(p => ({
			...(p.dataValues || p),
			...(voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false }),
			is_saved: savedSet.has(p.post_id)
        }));
        return stripExcludedAttributes(postsWithVotes);
    } catch (error) {
        console.error(new Date().toISOString(), 'Error in ApplyAlgorithm:', error);
		return [];
	}
}

export { ApplyAlgorithm };