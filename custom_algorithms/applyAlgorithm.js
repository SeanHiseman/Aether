import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { DeepFeedContent, Feeds, Followers, Posts, SavedPosts, ViewedPosts } from "../models/relationships.js";
import { Op } from 'sequelize';

const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'created_at', 'updated_at', 'poster_id']

async function ApplyAlgorithm({ locationId, excludedPostIds, feedId, includeOptions, isGroup = true, isMain, limit, offset, saverId, userId, keyword = '' }) {
    try {
        console.log("Applying algorithm for location:", locationId, "feedId:", feedId, "userId:", userId);
        console.log("search keyword:", keyword);
        let excludedIds = [];
        if (excludedPostIds) {
            if (Array.isArray(excludedPostIds)) {
                excludedIds = excludedPostIds;
            } else if (typeof excludedPostIds === 'string') {
                excludedIds = excludedPostIds.split(',').map(id => id.trim()).filter(Boolean);
            }
        }
        console.log("Excluded IDs:", excludedIds);
        let algorithm = {};
        let algorithmLocation = null;
        if (userId && locationId) {
            algorithmLocation = await AlgorithmLocations.findOne({ 
                where: { location_id: locationId, user_id: userId } 
            });
            console.log("User-specific algorithm location:", algorithmLocation);
            if (algorithmLocation) {
                const algorithmRow = await Algorithms.findOne({
                    attributes: ['algorithm_code'],
                    where: { algorithm_id: algorithmLocation.algorithm_id }
                });
                if (algorithmRow) {
                    try {
                        algorithm = JSON.parse(algorithmRow.algorithm_code);
                    } catch (error) {
                        console.error("Failed to parse algorithm JSON:", error);
                        algorithm = {};
                    }
                }
            }
        }
        let posts = [];
        const baseLimit = (limit ? parseInt(limit, 10) : 20) * 3;
        const baseOffset = offset ? parseInt(offset, 10) : 0;
        if (locationId === 'search' && keyword) {
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
                    post_id: { [Op.notIn]: excludedIds },
                    [Op.or]: [
                        { title: { [Op.like]: `%${keyword}%` } },
                        { text_body: { [Op.like]: `%${keyword}%` } }
                    ]
                },
                limit: baseLimit,
                offset: baseOffset,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === 'following' && userId) {
            const followedFeeds = await Followers.findAll({
                where: { follower_id: userId },
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
                limit: baseLimit,
                offset: baseOffset,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === 'explore') {
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
                limit: baseLimit,
                offset: baseOffset,
                order: [['created_at', 'DESC']]
            });
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
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
                limit: baseLimit,
                offset: baseOffset,
                order: [['created_at', 'DESC']]
            });
        } else {
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
                limit: baseLimit,
                offset: baseOffset,
                order: [['created_at', chronology === 'oldest' ? 'ASC' : 'DESC']]
            });
        }
        if (!posts.length) return [];
        const selectionLimit = limit ? parseInt(limit, 10) : 20;
        const shouldUseChronological = !isGroup || (algorithm.chronology === 1);
        if (shouldUseChronological) {
            const paginated = posts.slice(0, selectionLimit);
            const ids = paginated.map(p => p.post_id);
            const savedRows = saverId ? await SavedPosts.findAll({
                attributes: ['post_id'],
                raw: true,
                where: { post_id: { [Op.in]: ids }, saver_id: saverId }
            }) : [];
            const savedSet = new Set(savedRows.map(s => s.post_id));
            return paginated.map(post => ({
                ...post.dataValues,
                is_saved: savedSet.has(post.post_id)
            }));
        }
        if (!algorithmLocation && isGroup) {
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
            const savedRows = saverId ? await SavedPosts.findAll({
                attributes: ['post_id'],
                raw: true,
                where: { post_id: { [Op.in]: ids }, saver_id: saverId }
            }) : [];
            const savedSet = new Set(savedRows.map(s => s.post_id));
            return paginated.map(post => ({
                ...post,
                is_saved: savedSet.has(post.post_id)
            }));
        }
        const { variety = 1, scoring = {}, rules = [], contentType = { images: true, interactive: true, text: true, videos: true } } = algorithm;
        let processedPosts = [];
        for (const post of posts) {
            if (contentType.images === false && post.has_images) continue;
            if (contentType.interactive === false && post.has_interactive) continue;
            if (contentType.text === false && post.has_text) continue;
            if (contentType.videos === false && post.has_videos) continue;
            const createdAt = new Date(post.created_at);
            const postTimeStr = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            let isSuppressed = false;
            let score = 0;
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
                        default: return false;
                    }
                    if (subject === undefined || subject === null) return false;
                    switch (operator) {
                        case 'AFTER': return subject > value;
                        case 'BEFORE': return subject < value;
                        case 'EQUALS': return subject === value;
                        case 'CONTAINS': 
                            return typeof subject === 'string' && 
                                   subject.toLowerCase().includes(String(value).toLowerCase());
                        case 'CONTAINS_ANY': 
                            return Array.isArray(value) && typeof subject === 'string' && 
                                   value.some(v => subject.toLowerCase().includes(String(v).toLowerCase()));
                        case 'GREATER_THAN': return subject > value;
                        case 'LESS_THAN': return subject < value;
                        default: return false;
                    }
                });
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
                            case 'CONTAINS': 
                                return typeof subject === 'string' && 
                                       subject.toLowerCase().includes(String(value).toLowerCase());
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
            const { sentiment = 0, wordBoost = [], wordSuppress = [] } = scoring;
            if (wordBoost) {
                wordBoost.forEach(item => {
                    if (post.text_body && post.text_body.toLowerCase().includes(item.word.toLowerCase())) {
                        score += item.value || 10;
                    }
                });
            }
            if (wordSuppress) {
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
            processedPosts.push({
                ...post.dataValues,
                score
            });
        }
        processedPosts.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            const { chronology = 'newest' } = algorithm;
            return chronology === 'oldest' ? dateA - dateB : dateB - dateA;
        });
        const normalizedPosts = processedPosts.map(post => {
            const maxScore = Math.max(...processedPosts.map(p => p.score), 0);
            return {
                ...post,
                normScore: maxScore > 0 ? post.score / maxScore : 0
            };
        });
        const selected = [];
        const candidates = [...normalizedPosts];
        while (selected.length < selectionLimit && candidates.length > 0) {
            if (selected.length === 0) {
                let bestIdx = 0;
                for (let i = 1; i < candidates.length; i++) {
                    if (candidates[i].normScore > candidates[bestIdx].normScore) {
                        bestIdx = i;
                    }
                }
                selected.push(candidates.splice(bestIdx, 1)[0]);
                continue;
            }
            let bestIdx = 0;
            let bestScore = -Infinity;
            for (let i = 0; i < candidates.length; i++) {
                const candidate = candidates[i];
                let maxSimilarity = 0;
                for (const selectedPost of selected) {
                    let candVector = candidate.tfidf_vector ? 
                        (typeof candidate.tfidf_vector === 'string' ? 
                            JSON.parse(candidate.tfidf_vector) : candidate.tfidf_vector) : {};
                    let selVector = selectedPost.tfidf_vector ? 
                        (typeof selectedPost.tfidf_vector === 'string' ? 
                            JSON.parse(selectedPost.tfidf_vector) : selectedPost.tfidf_vector) : {};
                    const allKeys = new Set([...Object.keys(candVector), ...Object.keys(selVector)]);
                    let dotProduct = 0;
                    let candMagnitude = 0;
                    let selMagnitude = 0;
                    for (const key of allKeys) {
                        const candVal = candVector[key] || 0;
                        const selVal = selVector[key] || 0;
                        dotProduct += candVal * selVal;
                        candMagnitude += candVal * candVal;
                        selMagnitude += selVal * selVal;
                    }
                    const tfidfSim = (candMagnitude > 0 && selMagnitude > 0) ? 
                        dotProduct / (Math.sqrt(candMagnitude) * Math.sqrt(selMagnitude)) : 0;
                    const candBigrams = candidate.bigrams ? 
                        new Set(candidate.bigrams.split(',').map(b => b.trim())) : new Set();
                    const selBigrams = selectedPost.bigrams ? 
                        new Set(selectedPost.bigrams.split(',').map(b => b.trim())) : new Set();
                    const bigramIntersection = [...candBigrams].filter(x => selBigrams.has(x)).length;
                    const bigramUnion = new Set([...candBigrams, ...selBigrams]).size;
                    const bigramSim = bigramUnion > 0 ? bigramIntersection / bigramUnion : 0;
                    const candTrigrams = candidate.trigrams ? 
                        new Set(candidate.trigrams.split(',').map(t => t.trim())) : new Set();
                    const selTrigrams = selectedPost.trigrams ? 
                        new Set(selectedPost.trigrams.split(',').map(t => t.trim())) : new Set();
                    const trigramIntersection = [...candTrigrams].filter(x => selTrigrams.has(x)).length;
                    const trigramUnion = new Set([...candTrigrams, ...selTrigrams]).size;
                    const trigramSim = trigramUnion > 0 ? trigramIntersection / trigramUnion : 0;
                    const candKeywords = candidate.keywords ? 
                        new Set(candidate.keywords.split(',').map(k => k.trim().toLowerCase())) : new Set();
                    const selKeywords = selectedPost.keywords ? 
                        new Set(selectedPost.keywords.split(',').map(k => k.trim().toLowerCase())) : new Set();
                    const keywordIntersection = [...candKeywords].filter(x => selKeywords.has(x)).length;
                    const keywordUnion = new Set([...candKeywords, ...selKeywords]).size;
                    const keywordSim = keywordUnion > 0 ? keywordIntersection / keywordUnion : 0;
                    const sentimentDiff = Math.abs(candidate.sentiment_score - selectedPost.sentiment_score);
                    const sentimentSim = 1 - (sentimentDiff / 2); //Normalize to 0-1
                    const similarity = (tfidfSim * 0.4) + 
                                     (bigramSim * 0.15) + 
                                     (trigramSim * 0.15) + 
                                     (keywordSim * 0.2) + 
                                     (sentimentSim * 0.1);
                    if (similarity > maxSimilarity) {
                        maxSimilarity = similarity;
                    }
                }
                const relevanceWeight = 1 - variety;
                const diversityWeight = variety;
                const mmrScore = (relevanceWeight * candidate.normScore) - (diversityWeight * maxSimilarity);
                if (mmrScore > bestScore) {
                    bestScore = mmrScore;
                    bestIdx = i;
                }
            }
            selected.push(candidates.splice(bestIdx, 1)[0]);
        }
        console.log("Final selected posts:", selected.length);
        if (!selected.length) return [];
        const finalIds = selected.map(p => p.post_id);
        const savedRows = saverId ? await SavedPosts.findAll({
            attributes: ['post_id'],
            raw: true,
            where: { post_id: { [Op.in]: finalIds }, saver_id: saverId }
        }) : [];
        const savedSet = new Set(savedRows.map(s => s.post_id));
        return selected.map(p => {
            const { score, normScore, ...rest } = p;
            return {
                ...rest,
                is_saved: savedSet.has(p.post_id)
            };
        });
    } catch (error) {
        console.error("Error in ApplyAlgorithm:", error);
        return [];
    }
}

export { ApplyAlgorithm };