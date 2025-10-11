import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { DeepFeedContent, Feeds, Followers, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { Op } from 'sequelize';

const excludedAttrs = [
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

async function ApplyAlgorithm({ locationId, excludedPostIds, feedId, followedFeedIds, includeOptions, isGroup = true, isMain, limit, offset, recentUpvotes, viewerId, keyword = '' }) {
    try {
        //Followed feeds are a received as a string
        const followedFeedIdsSafe = (typeof followedFeedIds === "string")
            ? followedFeedIds.split(",")
            : (Array.isArray(followedFeedIds) ? followedFeedIds : []);

        //Already returned posts are excluded
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

        //Check if algorithm is active today
        let isActiveToday = false;
        if (algorithmLocation) {
            const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            isActiveToday = algorithm.activeDays && algorithm.activeDays.length > 0 ? algorithm.activeDays.map(d => d.toLowerCase()).includes(today) : true;
        }

        const useChronological = (!isGroup && !algorithmLocation) || (!isActiveToday && !isGroup) || (algorithm.chronology === 1); //User feeds without active algorithms or 1 chronology should be in time order only
        const useStandardScore = (!algorithmLocation && isGroup) || (!isActiveToday && isGroup);

        //Decide whether to fetch with all attributes or exclude them up front
        const fetchFullAttributes = !useChronological && !useStandardScore;

        //Collect recent upvoted posts for similarity comparison
        let recentUpvoteIds = [];
        let recentUpvoteEmbeddings = []
        if (viewerId && !recentUpvotes) {
            const foundRecentUpvotes = await PostVotes.findAll({
                attributes: ['post_id'],
                where: { 
                    voter_id: viewerId,
                    upvotes: { [Op.gt]: 0 },
                    downvotes: { [Op.lte]: 0 }
                },
                order: [['updated_at', 'DESC']],
                limit: 100
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
        const attrOption = fetchFullAttributes ? undefined : { exclude: excludedAttrs };

        if (locationId === "search" && keyword) { //Search results
            posts = await Posts.findAll({
                include: includeOptions,
                attributes: attrOption,
                where: {
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds },
                    [Op.or]: [
                        { title: { [Op.like]: `%${keyword}%` } },
                        { text_body: { [Op.like]: `%${keyword}%` } }
                    ],
                    is_private: false
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === "following") { //Followed feeds
            if (followedFeedIdsSafe.length === 0) return [];
            posts = await Posts.findAll({
                include: includeOptions,
                attributes: attrOption,
                where: {
                    feed_id: { [Op.in]: followedFeedIdsSafe },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds },
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === "explore") { //Explore page
            posts = await Posts.findAll({
                include: includeOptions,
                attributes: attrOption,
                where: {
                    feed_id: { [Op.notIn]: followedFeedIdsSafe }, //Excluded followed feeds
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds },
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
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
                    attributes: ['feed_id']
                });
                const feedIds = [];
                for (const content of contents) {
                    if (content.feed_id) {
                        feedIds.push(content.feed_id);
                    }
                }
                return feedIds;
            };
            const deepFeedId = locationId.replace(/^deep_/, ''); //strip prefix
            const allFeedIds = await getAllFeedIdsInDeepFeed(deepFeedId);
            if (allFeedIds.length === 0) return [];
            posts = await Posts.findAll({
                include: includeOptions,
                attributes: attrOption,
                where: {
                    feed_id: { [Op.in]: allFeedIds },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds },
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
                },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        } else { //Feed channel
            const whereChannel = {
                ...(isMain !== 'true' && locationId ? { channel_id: locationId } : {}), //True from query is a string
                feed_id: feedId,
                parent_id: null,
                post_id: { [Op.notIn]: excludedIds }
            };
            posts = await Posts.findAll({
                include: includeOptions,
                attributes: attrOption,
                where: whereChannel,
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']]
            });
        }
        if (!posts.length) return [];

        //Pure chronological order
        const selectionLimit = limit ? parseInt(limit, 10) : 20;
        if (useChronological) { 
            const paginated = posts.slice(0, selectionLimit);
            const ids = paginated.map(p => p.post_id);
            const savedRows = viewerId ? await SavedPosts.findAll({
                attributes: ['post_id'],
                raw: true,
                where: { post_id: { [Op.in]: ids }, saver_id: viewerId }
            }) : [];
            const savedSet = new Set(savedRows.map(s => s.post_id));
            return stripExcludedAttributes(paginated).map(post => ({
                ...post,
                is_saved: savedSet.has(post.post_id)
            }));
        }

        //Weighted only by time-vote score
        if (useStandardScore) { 
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
            return stripExcludedAttributes(paginated).map(post => ({
                ...post,
                is_saved: savedSet.has(post.post_id)
            }));
        }

        //Filter out posts, then apply scoring
        const finalPosts = [];
        const { chronology = "newest", contentType = {}, variety = 1, textLimits = {}, videoLimits = {}, timeLimits = {}, dateLimits = {}, scoring = {} } = algorithm;
        const { sentiment = 0, voteImpact = 1, wordBoost = [], wordSuppress = [] } = scoring;
        const chronoPref = chronology === "oldest" ? -1 : 1;

        for (const post of posts) {
            //Content type filtering
            if (contentType.images === false && post.has_images) continue;
            if (contentType.videos === false && post.has_videos) continue;
            if (contentType.text === false && post.has_text) continue;
            if (contentType.interactive === false && post.has_interactive) continue;
            if (contentType.has_embedded_websites === false && post.has_embedded_websites) continue;
            if (contentType.has_external_posts === false && post.has_external_posts) continue;

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

            //Date range filtering
            if (dateLimits.from && new Date(post.created_at) < new Date(dateLimits.from)) continue;
            if (dateLimits.to && new Date(post.created_at) > new Date(dateLimits.to)) continue;

            //Filtering complete, assign score to passed posts
            let score = 0;

            //Chronology scoring
            const ageInHours = (Date.now() - new Date(post.created_at)) / (1000 * 60 * 60);
            score += chronoPref * ageInHours;

            //Vote impact (quality ratio × engagement ratio)
            const totalVotes = (post.upvotes || 0) + (post.downvotes || 0);
            const qualityRatio = totalVotes > 0 ? (post.upvotes || 0) / totalVotes : 0.5;
            const engagementRatio = (post.views || 0) > 0 ? totalVotes / post.views : 0;
            score += voteImpact * qualityRatio * engagementRatio;

            //Word boosts/suppressions
            wordBoost.forEach(({ word, value }) => {
                if (post.text_body && post.text_body.toLowerCase().includes(word.toLowerCase())) {
                    score += value;
                }
            });
            wordSuppress.forEach(({ word, value }) => {
                if (post.text_body && post.text_body.toLowerCase().includes(word.toLowerCase())) {
                    score += value;
                }
            });

            //Sentiment comparison
            if (typeof post.sentiment_score === "number") {
                const sentimentDistance = Math.abs(post.sentiment_score - sentiment);
                const sentimentBoost = (0.5 - sentimentDistance) * 20; 
                score += sentimentBoost;
            }

            //Variety scoring (cosine similarity against recent views)
            let postEmbedding = null;
            try {
                postEmbedding = post.embeddings ? JSON.parse(post.embeddings) : null;
            } catch {
                postEmbedding = null;
            }
            let maxSimilarity = 0;
            if (postEmbedding && Array.isArray(postEmbedding) && recentUpvoteEmbeddings.length > 0) {
                for (const ve of recentUpvoteEmbeddings) {
                    if (Array.isArray(ve) && ve.length === postEmbedding.length) {
                        const similarity = CosineSimilarity(postEmbedding, ve);
                        if (similarity > maxSimilarity) maxSimilarity = similarity;
                    }
                }
            }
            const similarityComponent = ((1 - maxSimilarity) * variety * 10) + (maxSimilarity * (1 - variety) * 5);
            score += similarityComponent;
            finalPosts.push({
                ...post.dataValues,
                score
            });
        }

        if (!finalPosts.length) return [];
        finalPosts.sort((a, b) => b.score - a.score); //Sort posts by score
        //Add saved info to posts
        const finalIds = finalPosts.map(p => p.post_id);
        const savedRows = viewerId ? await SavedPosts.findAll({ 
            attributes: ['post_id'],
            raw: true,
            where: { post_id: { [Op.in]: finalIds }, saver_id: viewerId }
        }) : [];
        const savedSet = new Set(savedRows.map(s => s.post_id));
        //Return final selection of posts
        return stripExcludedAttributes(finalPosts).map(post => {
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