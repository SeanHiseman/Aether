import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { DeepFeedContent, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
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

async function ApplyAlgorithm({ locationId, feedId, followedFeedIds, includeOptions, isGroup = true, isMain, limit = 100, offset, recentUpvotes, viewerId, keyword = '' }) {
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
				const recentUpvotePosts = await Posts.findAll({
					attributes: ['embeddings'],
					where: { post_id: { [Op.in]: recentUpvoteIds } },
					raw: true
				});
				recentUpvoteEmbeddings = recentUpvotePosts
					.map(p => { try { return p.embeddings ? JSON.parse(p.embeddings) : null; } catch { return null; } }) //Get embeddings of recently upvoted posts
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
				where: Sequelize.literal(`MATCH (title, text_body) AGAINST (${Posts.sequelize.escape(keyword)} IN NATURAL LANGUAGE MODE)`),
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
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    feed_id: { [Op.in]: followedFeedIdsSafe },
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
        } else if (locationId === "explore") {
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    feed_id: { [Op.notIn]: followedFeedIdsSafe },
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
                    is_private: false
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
		const finalPosts = [];
        const { chronology = 1, contentType = {}, variety = 1, textLimits = {}, videoLimits = {}, timeLimits = {}, dateLimits = {}, scoring = {} } = algorithm;
		const { sentiment = 0, voteImpact = 1, wordBoost = [], wordSuppress = [] } = scoring;

		for (const post of posts) {
            //Content type filtering
			if (contentType.images === false && post.has_images) continue;
			if (contentType.videos === false && post.has_videos) continue;
			if (contentType.text === false && post.has_text) continue;
			if (contentType.interactive === false && post.has_interactive) continue;
			if (contentType.embeddedWebsites === false && post.has_embedded_websites) continue;
			if (contentType.externalPosts === false && post.has_external_posts) continue;
            //Text length filtering
			if (textLimits.min && post.text_length < textLimits.min) continue;
			if (textLimits.max && post.text_length > textLimits.max) continue;
            //Video length filtering
			if (videoLimits.min && post.video_length < videoLimits.min) continue;
			if (videoLimits.max && post.video_length > videoLimits.max) continue;
            //Time of day filtering
			if (timeLimits.startTime && timeLimits.endTime) {
				const createdAt = new Date(post.created_at);
				const postTime = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
				if (postTime < timeLimits.startTime || postTime > timeLimits.endTime) continue;
			}
            // Date range filtering
			if (dateLimits.from && new Date(post.created_at) < new Date(dateLimits.from)) continue;
			if (dateLimits.to && new Date(post.created_at) > new Date(dateLimits.to)) continue;

			let score = 0;
			const baseHotness = post.rank_hotness;
			score += (chronology ?? 1) * baseHotness;

            //Vote quality * engagement ratio (distinct from hotness)
			const totalVotes = (post.upvotes || 0) + (post.downvotes || 0);
			const qualityRatio = totalVotes > 0 ? (post.upvotes || 0) / totalVotes : 0.5;
			const engagementRatio = (post.views || 0) > 0 ? totalVotes / post.views : 0;
			score += voteImpact * ((qualityRatio * 0.7) + (engagementRatio * 0.3));

			let keywordComponent = 0, shouldSuppress = false;
			if (post.text_body) {
				const textLower = post.text_body.toLowerCase();
				for (const w of wordSuppress) {
					if (textLower.includes(w.toLowerCase())) { shouldSuppress = true; break; }
				}
				if (shouldSuppress) continue;
				for (const w of wordBoost) {
					if (textLower.includes(w.toLowerCase())) keywordComponent += 10;
				}
			}

            //Semantic boost/suppress using word embeddings
			if (post.embeddings && (algorithmRow?.boost_embedding || algorithmRow?.suppress_embedding)) {
				let postEmbedding = null;
				try { postEmbedding = JSON.parse(post.embeddings); } catch { postEmbedding = null; }
				if (Array.isArray(postEmbedding)) {
					const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
					const normPost = postEmbedding.map(v => v / magPost);
                    let semanticBoost = 0;
                    let semanticSuppress = 0;
					if (algorithmRow.boost_embedding) {
						const boostVec = JSON.parse(algorithmRow.boost_embedding);
						if (Array.isArray(boostVec) && boostVec.length === normPost.length)
							semanticBoost = CosineSimilarity(normPost, boostVec);
					}
					if (algorithmRow.suppress_embedding) {
						const suppressVec = JSON.parse(algorithmRow.suppress_embedding);
						if (Array.isArray(suppressVec) && suppressVec.length === normPost.length)
							semanticSuppress = CosineSimilarity(normPost, suppressVec);
					}
					score += (semanticBoost * 10) - (semanticSuppress * 10);
				}
			}
			score += keywordComponent;

            //Sentiment alignment
			const sentimentDistance = Math.abs(post.sentiment_score - sentiment);
			score += (0.5 - sentimentDistance) * 20;

            //Variety scoring (cosine similarity against recent upvoted embeddings)
			let postEmbedding = null;
			if (recentUpvoteEmbeddings.length && typeof post.embeddings === 'string' && post.embeddings.startsWith('[')) {
				try { postEmbedding = JSON.parse(post.embeddings); } catch { postEmbedding = null; }
			}
			let maxSimilarity = 0;
			if (postEmbedding && Array.isArray(postEmbedding) && normalisedRecentEmbeddings.length > 0) {
				const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
				const normPost = postEmbedding.map(v => v / magPost);
				for (const ve of normalisedRecentEmbeddings) {
					if (ve.length === normPost.length) {
						const sim = CosineSimilarity(normPost, ve);
						if (sim > maxSimilarity) maxSimilarity = sim;
					}
				}
			}
			score += ((1 - maxSimilarity) * variety * 10) + (maxSimilarity * (1 - variety) * 5);

			finalPosts.push({ ...post.dataValues, score });
		}

		if (!finalPosts.length) return [];
        finalPosts.sort((a, b) => b.score - a.score); //Sort posts by score
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
        console.error('Error in ApplyAlgorithm:', error);
		return [];
	}
}

export { ApplyAlgorithm };