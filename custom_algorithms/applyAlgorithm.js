import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { DeepFeedContent, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
import { ExternalPosts, ExternalPostsAccess } from "../models/content.js";
import { generateBlueskyContentHTML, generateMastodonContentHTML, generateRedditContentHTML } from "../routes/socialConnect.js";
import { Op } from 'sequelize';
import Sequelize from 'sequelize';

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
			algorithmLocation = await AlgorithmLocations.findOne({
				where: { location_id: locationId, viewer_id: viewerId },
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
		let isActiveToday = false;
		if (algorithmLocation) {
			const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            isActiveToday = algorithm.activeDays && algorithm.activeDays.length > 0 ? algorithm.activeDays.map(d => d.toLowerCase()).includes(today) : true;
		}

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
				recentUpvoteEmbeddings = recentUpvotePosts
					.map(p => p.embeddings || null) //Get embeddings of recently upvoted posts
					.filter(Boolean);
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
			//Calculate posts per source (local + up to 3 external sources)
			const enabledSources = [];
			if (connectedAccounts.find(a => a.platform === 'reddit')) enabledSources.push('reddit');
			if (connectedAccounts.find(a => a.platform === 'bluesky')) enabledSources.push('bluesky');
			if (connectedAccounts.find(a => a.platform === 'mastodon')) enabledSources.push('mastodon');
			const totalSources = 1 + enabledSources.length; //local + external sources
			//console.log("totalSources:", totalSources);
			//const postsPerSource = Math.floor((limit * 3) / totalSources); //Get 3 times as many posts as is needed
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
			//console.log("local posts:", postIds.length);
			const orderedIds = postIds.map(p => p.post_id);
			posts = await Posts.findAll({
				where: { post_id: orderedIds },
				include: includeOptions,
				attributes: attrOption,
				raw: false
			});
			const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
			posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
			//Fetch external posts directly from database
			const externalPostsArrays = await Promise.all(
				enabledSources.map(async (platform) => {
					if (!userId) return [];
					const accesses = await ExternalPostsAccess.findAll({
						where: { user_id: userId, source: platform },
						attributes: ['post_id'],
						limit: postsPerSource
					});
					//console.log("external post accesses length:", accesses.length);
					const extPostIds = accesses.map(a => a.post_id).filter(Boolean);
					if (!extPostIds.length) return [];
					const extPosts = await ExternalPosts.findAll({
						where: { post_id: extPostIds, source: platform },
						order: [['rank_hotness', 'DESC']],
						limit: postsPerSource,
						raw: true
					});
					//console.log("external posts length:", extPosts.length);
					//Format external posts to match widget expectations
					return extPosts.map(p => {
						const media = typeof p.media === 'string' ? JSON.parse(p.media) : p.media;
						let contentHTML = '';
						let sourceName = '';
						if (platform === 'reddit') {
							contentHTML = generateRedditContentHTML(p.text_body, media);
							sourceName = 'Reddit';
						} else if (platform === 'bluesky') {
							contentHTML = generateBlueskyContentHTML(p.text_body, media);
							sourceName = 'Bluesky';
						} else if (platform === 'mastodon') {
							contentHTML = generateMastodonContentHTML(p.text_body, media);
							sourceName = 'Mastodon';
						}
						const username = platform === 'reddit' ? (p.author || '').replace('u/','') : p.author;
						const externalScore = p.score ?? 0;
						return {
							...p,
							isExternal: true,
							created_at: p.created_at_remote,
							content: `data:text/html;charset=utf-8,${encodeURIComponent(contentHTML)}`,
							has_interactive: false,
							has_embedded_websites: false,
							has_external_posts: false,
							poster: {
								username: p.author || `${platform}_user`,
								user_photo: p.author_photo || `/media/site_images/default-${platform}-user-icon.png`,
								profile_url: platform === 'reddit' ? `https://www.reddit.com/user/${username}` :
											platform === 'bluesky' ? `https://bsky.app/profile/${p.author}` :
											p.url
							},
							channel: p.channel || platform,
							source: sourceName,
							upvotes: externalScore, //Equivalent to upvotes
							downvotes: 0,
							views: 0,
							replies: p.replies || 0,
							is_saved: false,
							has_upvoted: false,
							has_downvoted: false,
						};
					});
				})
			);
			//console.log("externalPostsArrays length:", externalPostsArrays.length);
			const allExternalPosts = externalPostsArrays.flat();
			posts = [...posts.map(p => ({ ...(p.dataValues || p), isExternal: false })), ...allExternalPosts];
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
		const { sentiment = 0, voteImpact = 1, wordBoost = [], wordSuppress = [] } = scoring;
		//console.log("algorithm:", algorithm);
		//console.log("scoring:", scoring);
		//console.log("posts:", posts);
		//console.log("algorithm:", algorithm);
		//console.log("posts length:", posts.length);

		//Predefined variables for use in scoring
		const now = Date.now();
		const tenDays = 864000000;
		try {
			for (const post of posts) {
				const postEmbedding = post.embeddings;
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
					const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
					const normPost = postEmbedding.map(v => v / magPost);
					let semanticBoost = 0;
					let semanticSuppress = 0;
					let boostWords = [];
					let suppressWords = [];
					try {
						const algoJson = JSON.parse(algorithmRow.algorithm_code);
						boostWords = algoJson.scoring?.wordBoost || [];
						suppressWords = algoJson.scoring?.wordSuppress || [];
					} catch {}
					if (algorithmRow.boost_embedding) {
						const boostVecs = algorithmRow.boost_embedding;
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
						const suppressVecs = algorithmRow.suppress_embedding;
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