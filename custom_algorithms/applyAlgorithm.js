import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { DeepFeedContent, Feeds, Followers, Posts, SavedPosts, ViewedPosts } from "../models/relationships.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { Op } from 'sequelize';

const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'created_at', 'updated_at', 'poster_id']

async function ApplyAlgorithm({ locationId, excludedPostIds, feedId, includeOptions, isGroup = true, isMain, limit, offset, viewerId, keyword = '' }) {
    try {
        let excludedIds = [];
        if (excludedPostIds) {
            if (Array.isArray(excludedPostIds)) {
                excludedIds = excludedPostIds;
            } else if (typeof excludedPostIds === 'string') {
                excludedIds = excludedPostIds.split(',').map(id => id.trim()).filter(Boolean);
            }
        }

        //Find if there is an algorithm applied at this location
        let algorithm = {};
        let algorithmLocation = null;
        if (viewerId && locationId) {
            algorithmLocation = await AlgorithmLocations.findOne({ 
                where: { location_id: locationId, viewer_id: viewerId } 
            });
            if (algorithmLocation) {
                const algorithmRow = await Algorithms.findOne({
                    attributes: ['algorithm_code'],
                    where: { algorithm_id: algorithmLocation.algorithm_id }
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

        //Merge already returned (exluded) posts with viewedPosts 
        let varietyPostIds = [...excludedIds];
        if (viewerId) {
            const recentViewed = await ViewedPosts.findAll({
                attributes: ['post_id'],
                where: { viewer_id: viewerId },
                order: [['updated_at', 'DESC']], //Most recent view
                limit: 100, //100 most recently viewed posts
                raw: true
            });
            varietyPostIds.push(...recentViewed.map(row => row.post_id));
        }
        const uniqueVarietyIds = [...new Set(varietyPostIds)];
        let varietyEmbeddings = [];
        if (uniqueVarietyIds.length > 0) {
            const varietyPosts = await Posts.findAll({
                attributes: ['embeddings'],
                where: { post_id: { [Op.in]: uniqueVarietyIds } },
                raw: true
            });
            varietyEmbeddings = varietyPosts
                .map(p => {
                    try {
                        return p.embeddings ? JSON.parse(p.embeddings) : null;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
        }

        //Fetch posts according to location
        let posts = [];
        if (locationId === 'search' && keyword) { //Search results
            const publicFeeds = await Feeds.findAll({
                where: { type: { [Op.ne]: 'private' } },
                attributes: ['feed_id'],
                limit: limit,
            });
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: {
                    feed_id: { [Op.in]: publicFeeds.map(f => f.feed_id) },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds },
                    [Op.or]: [
                        { title: { [Op.like]: `%${keyword}%` } },
                        { text_body: { [Op.like]: `%${keyword}%` } }
                    ]
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === 'following' && viewerId) { //Followed feeds
            const followedFeeds = await Followers.findAll({
                where: { follower_id: viewerId },
                attributes: ['feed_id']
            });
            if (followedFeeds.length === 0) return [];
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: {
                    feed_id: { [Op.in]: followedFeeds.map(f => f.feed_id) },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds }
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === 'explore') { //Explore page
            const publicFeeds = await Feeds.findAll({
                where: { type: { [Op.ne]: 'private' } },
                attributes: ['feed_id']
            });
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: {
                    feed_id: { [Op.in]: publicFeeds.map(f => f.feed_id) },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds }
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) { //Combined feeds 
            const getAllFeedIdsInDeepFeed = async (deepFeedId, visited = new Set()) => {
                if (visited.has(deepFeedId)) return [];
                visited.add(deepFeedId);
                const contents = await DeepFeedContent.findAll({
                    where: { deep_feed_id: deepFeedId },
                    attributes: ['feed_id', 'nested_deep_feed_id']
                });
                const feedIds = [];
                for (const content of contents) {
                    if (content.feed_id) {
                        feedIds.push(content.feed_id);
                    }
                    if (content.nested_deep_feed_id) {
                        const nested = await getAllFeedIdsInDeepFeed(content.nested_deep_feed_id, visited);
                        feedIds.push(...nested);
                    }
                }
                return feedIds;
            };
            const deepFeedId = locationId.replace('deep_', '');
            const allFeedIds = await getAllFeedIdsInDeepFeed(deepFeedId);
            if (allFeedIds.length === 0) return [];
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: {
                    feed_id: { [Op.in]: allFeedIds },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds }
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else { //Feed channel
            const whereChannel = {
                ...(isMain !== 'true' && locationId ? { channel_id: locationId } : {}),
                feed_id: feedId,
                parent_id: null,
                post_id: { [Op.notIn]: excludedIds }
            };
            const { chronology = 'newest' } = algorithm;
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: whereChannel,
                limit: limit,
                offset: offset,
                order: [['created_at', chronology === 'oldest' ? 'ASC' : 'DESC']]
            });
        }
        if (!posts.length) return [];

        //Return posts when no algorithm is found
        const selectionLimit = limit ? parseInt(limit, 10) : 20;
        const shouldUseChronological = (!isGroup && !algorithmLocation) || (algorithm.chronology === 1); //User feeds without algorithms and 1 chronology should be in time order only
        if (shouldUseChronological) { //Pure chronological order
            const paginated = posts.slice(0, selectionLimit);
            const ids = paginated.map(p => p.post_id);
            const savedRows = viewerId ? await SavedPosts.findAll({
                attributes: ['post_id'],
                raw: true,
                where: { post_id: { [Op.in]: ids }, saver_id: viewerId }
            }) : [];
            const savedSet = new Set(savedRows.map(s => s.post_id));
            return paginated.map(post => ({
                ...post.dataValues,
                is_saved: savedSet.has(post.post_id)
            }));
        }
        if (!algorithmLocation && isGroup) { //Weighted by views, votes, and time
            const postsWithScores = posts.map(post => {
                const totalVotes = (post.upvotes || 0) + (post.downvotes || 0);
                const qualityScore = totalVotes > 0 ? (post.upvotes || 0) / totalVotes : 0.5;
                const engagementScore = (post.views || 0) > 0 ? totalVotes / (post.views || 1) : 0;
                const ageInHours = (Date.now() - new Date(post.created_at)) / (1000 * 60 * 60);
                const timeScore = Math.exp(-ageInHours / 72);
                const defaultScore = (qualityScore * 0.4) + (engagementScore * 0.4) + (timeScore * 0.2);
                return {
                    ...post.dataValues,
                    score: defaultScore
                };
            });
            postsWithScores.sort((a, b) => b.score - a.score);
            const paginated = postsWithScores.slice(0, selectionLimit);
            const ids = paginated.map(p => p.post_id);
            const savedRows = viewerId ? await SavedPosts.findAll({
                attributes: ['post_id'],
                raw: true,
                where: { post_id: { [Op.in]: ids }, saver_id: viewerId }
            }) : [];
            const savedSet = new Set(savedRows.map(s => s.post_id));
            return paginated.map(post => ({
                ...post,
                is_saved: savedSet.has(post.post_id)
            }));
        }

        //Filter out posts, then apply scoring
        const finalPosts = [];
		const { chronology = 0, contentType = { images: true, interactive: true, text: true, videos: true }, rules = [], scoring = {}, timeScaleHours = 72, variety = 1 } = algorithm;
		const { sentiment = 0, timeWeight = 5, wordBoost = [], wordSuppress = [] } = scoring;
        const chronoPref = Math.max(-1, Math.min(1, chronology)); //Is preference for older or newer posts
        for (const post of posts) {
            if (contentType.images === false && post.has_images) continue;
            if (contentType.interactive === false && post.has_interactive) continue;
            if (contentType.text === false && post.has_text) continue;
            if (contentType.videos === false && post.has_videos) continue;
            const createdAt = new Date(post.created_at);
            const postTimeStr = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            let isSuppressed = false;
            let score = 0;

            //Apply chronological adjustments
            const ageInHours = (Date.now() - new Date(post.created_at)) / (1000 * 60 * 60);
            const scale = typeof timeScaleHours === 'number' ? timeScaleHours : 72;
            const k = 4 / scale;
            const ageFactor = 1 - 2 / (1 + Math.exp(-k * (ageInHours - scale / 2)));
            score += chronoPref * (ageFactor * timeWeight);

            //Iterate though every filter condition
            for (const rule of rules) {
                const conditionsMet = rule.conditions.every(condition => {
                    const { field, operator, value } = condition;
                    let subject;
                    switch (field) {
                        case 'post_time': subject = postTimeStr; break;
                        case 'body': subject = post.text_body; break;
                        case 'sentiment_score': subject = post.sentiment_score; break;
                        case 'has_images': subject = post.has_images; break;
                        case 'has_videos': subject = post.has_videos; break;
                        case 'has_text': subject = post.has_text; break;
                        case 'word_count': subject = post.word_count; break;
                        case 'text_length': subject = post.text_length; break;
                        case 'video_length': subject = post.video_length; break;
                        default: return false;
                    }
                    if (subject === undefined || subject === null) return false;
                    switch (operator) {
                        case 'AFTER': return subject > value;
                        case 'BEFORE': return subject < value;
                        case 'EQUALS': return subject === value;
                        case 'CONTAINS': return typeof subject === 'string' && subject.toLowerCase().includes(String(value).toLowerCase());
                        case 'CONTAINS_ANY': return Array.isArray(value) && typeof subject === 'string' && value.some(v => subject.toLowerCase().includes(String(v).toLowerCase()));
                        case 'GREATER_THAN': return subject > value;
                        case 'LESS_THAN': return subject < value;
                        default: return false;
                    }
                });

                //Post has passed the fitler
                if (conditionsMet) {
                    const exceptionMet = rule.exceptions?.some(exc => {
                        const { field, operator, value } = exc.condition;
                        let subject;
                        switch (field) {
                            case 'post_time': subject = postTimeStr; break;
                            case 'body': subject = post.text_body; break;
                            case 'sentiment_score': subject = post.sentiment_score; break;
                            case 'has_images': subject = post.has_images; break;
                            case 'has_videos': subject = post.has_videos; break;
                            case 'has_text': subject = post.has_text; break;
                            default: return false;
                        }
                        switch (operator) {
                            case 'AFTER': return subject > value;
                            case 'BEFORE': return subject < value;
                            case 'EQUALS': return subject === value;
                            case 'CONTAINS': return typeof subject === 'string' && subject.toLowerCase().includes(String(value).toLowerCase());
                            case 'GREATER_THAN': return subject > value;
                            case 'LESS_THAN': return subject < value;
                            default: return false;
                        }
                    });
                    if (exceptionMet) continue;
                    switch (rule.action.type) {
                        case 'SUPPRESS': isSuppressed = true; break;
                        case 'BOOST': score += rule.action.value || 0; break;
                        case 'PENALIZE': score -= rule.action.value || 0; break;
                    }
                }
                if (isSuppressed) break;
            }
            if (isSuppressed) continue;

            if (Array.isArray(wordBoost)) {
                wordBoost.forEach(item => {
                    if (post.text_body && post.text_body.toLowerCase().includes(item.word.toLowerCase())) {
                        score += item.value || 10;
                    }
                });
            }
            if (Array.isArray(wordSuppress)) {
                wordSuppress.forEach(item => {
                    if (post.text_body && post.text_body.toLowerCase().includes(item.word.toLowerCase())) {
                        score += item.value || -10;
                    }
                });
            }
            if (sentiment !== undefined && typeof post.sentiment_score === 'number') {
                const sentimentDistance = Math.abs(post.sentiment_score - sentiment);
                score += (1 - sentimentDistance) * 10;
            }
            let postEmbedding = null;
            try {
                postEmbedding = post.embeddings ? JSON.parse(post.embeddings) : null;
            } catch {
                postEmbedding = null;
            }
            let maxSimilarity = 0;
            if (postEmbedding && Array.isArray(postEmbedding) && varietyEmbeddings.length > 0) {
                for (const ve of varietyEmbeddings) {
                    if (Array.isArray(ve) && ve.length === postEmbedding.length) {
                        const similarity = CosineSimilarity(postEmbedding, ve);
                        if (similarity > maxSimilarity) maxSimilarity = similarity;
                    }
                }
            }
            const v = (typeof variety === 'number') ? variety : 1;
            const similarityComponent = ((1 - maxSimilarity) * v * 10) + (maxSimilarity * (1 - v) * 5);
            score += similarityComponent;
            finalPosts.push({
                ...post.dataValues,
                score,
                _maxSimilarity: maxSimilarity
            });
        }
		if (!finalPosts.length) return [];
        finalPosts.sort((a, b) => b.score - a.score); //Sort posts by score

        //Add saved info to posts
		const finalIds = finalPosts.map(p => p.post_id);
		const savedRows = saverId ? await SavedPosts.findAll({ 
			attributes: ['post_id'],
			raw: true,
			where: { post_id: { [Op.in]: finalIds }, saver_id: saverId }
		}) : [];
		const savedSet = new Set(savedRows.map(s => s.post_id));

        //Return final selection of posts
		return finalPosts.map(post => {
			const { score, _maxSimilarity, ...rest } = post;
			return {
				...rest,
				is_saved: savedSet.has(post.post_id)
			};
		});
	} catch (error) {
		return [];
	}
}

export { ApplyAlgorithm };