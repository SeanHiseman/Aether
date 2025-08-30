import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { Followers, Posts, SavedPosts, ViewedPosts } from "../models/relationships.js";
import cheerio from 'cheerio';
import { Op } from 'sequelize';
import Sentiment from 'sentiment';

const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'created_at', 'updated_at', 'poster_id']
const sentiment = new Sentiment();

function analyseSentiment(htmlContent) {
    if (!htmlContent) return 0;
    const $ = cheerio.load(htmlContent);
    $('script, style').remove();
    const cleanText = $.text()
        .trim()
        .replace(/\s+/g, ' ') //Replace multiple whitespace with single space
        .replace(/[^\w\s.,!?-]/g, '') //Remove special characters except basic punctuation
        .toLowerCase();
    if (!cleanText) return 0;
    const result = sentiment.analyze(cleanText);
    let normalisedScore = 0;
    if (result.tokens.length > 0) {
		const avgSentiment = result.score / result.tokens.length; //Sentiment per token
		normalisedScore = Math.tanh(avgSentiment) //Normalise to range [-1, 1]
    }
    return normalisedScore;
}

async function ApplyAlgorithm({ locationId, excludedPostIds, feedId, includeOptions, isMain, limit, offset, saverId, userId, keyword = '' }) {
    try {
        console.log("Applying algorithm for location:", locationId, "feedId:", feedId, "userId:", userId);
        const excludedIds = excludedPostIds ? excludedPostIds.split(',') : [];
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
                        { content: { [Op.like]: `%${keyword}%` } }
                    ]
                },
                limit: (limit ? parseInt(limit, 20) : 20) * 3,
                offset: offset ? parseInt(offset, 20) : 0,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === 'following' && userId) {
            const followedFeeds = await Followers.findAll({
                where: { follower_id: userId },
                attributes: ['feed_id']
            });
            if (followedFeeds.length === 0) return [];
            const followedFeedIds = followedFeeds.map(f => f.feed_id);
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: {
                    feed_id: { [Op.in]: followedFeedIds },
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds }
                },
                limit: (limit ? parseInt(limit, 20) : 20) * 3,
                offset: offset ? parseInt(offset, 20) : 0,
                order: [['created_at', 'DESC']]
            });
        } else if (locationId === 'explore') {
            const { Feeds } = await import('../models/relationships.js');
            const publicFeeds = await Feeds.findAll({
                where: { type: { [Op.ne]: 'private' } },
                attributes: ['feed_id']
            });
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                where: {
                    feed_id: { [Op.in]: publicFeeds.map(f => f.feed_id).slice(0, 10) }, 
                    parent_id: null,
                    post_id: { [Op.notIn]: excludedIds }
                },
                limit: (limit ? parseInt(limit, 20) : 20) * 3,
                offset: offset ? parseInt(offset, 20) : 0,
                order: [['created_at', 'DESC']]
            });
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
            const { DeepFeedContent } = await import('../models/relationships.js');
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
                limit: (limit ? parseInt(limit, 20) : 20) * 3,
                offset: offset ? parseInt(offset, 20) : 0,
                order: [['created_at', 'DESC']]
            });
        } else {
            const whereChannel = {
                ...(isMain !== 'true' && locationId ? { channel_id: locationId } : {}),
                feed_id: feedId,
                parent_id: null,
                post_id: { [Op.notIn]: excludedIds }
            };
            const initialLimit = (limit ? parseInt(limit, 20) : 20) * 3;
            const { chronology = 'newest' } = algorithm;
            posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                limit: initialLimit,
                offset: offset ? parseInt(offset, 20) : 0,
                where: whereChannel,
                order: [['created_at', chronology === 'oldest' ? 'ASC' : 'DESC']]
            });
        }
        if (!posts.length) return [];
        if (!algorithmLocation) {
            const selectionLimit = limit ? parseInt(limit, 20) : 20;
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
        const { variety = 1, scoring = {}, rules = [] } = algorithm;
        const evaluateCondition = (postContext, condition) => {
            const { field, operator, value } = condition;
            const { post, has_images, has_videos, has_text, text_body, post_time_str } = postContext;
            let subject;
            switch (field) {
                case 'post_time': subject = post_time_str; break;
                case 'body': subject = text_body; break;
                case 'category': subject = post.category; break;
                case 'sentiment_score': subject = post.sentiment; break;
                case 'has_images': subject = has_images; break;
                case 'has_videos': subject = has_videos; break;
                case 'has_text': subject = has_text; break;
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
        };
        let processedPosts = [];
        for (const post of posts) {
            const $ = cheerio.load(post.content || '');
            $('script, style').remove();
            const createdAt = new Date(post.created_at);
            const postContext = {
                has_images: $('img').length > 0,
                has_interactive: $('.content-block.code-block, .content-block.app-block, pre, iframe').length > 0,
                has_text: $.text().trim().length > 0,
                has_videos: $('video').length > 0,
                post: post.dataValues,
                post_time_str: `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`,
                text_body: $.text().trim()
            };
            const { contentType = { images: true, interactive: true, text: true, videos: true } } = algorithm;
            if (contentType.images === false && postContext.has_images) continue;
            if (contentType.interactive === false && postContext.has_interactive) continue;
            if (contentType.text === false && postContext.has_text) continue;
            if (contentType.videos === false && postContext.has_videos) continue;
            const sentimentScore = analyseSentiment(postContext.text_body);
            post.dataValues.sentiment = sentimentScore;
            let isSuppressed = false;
            let score = 0;
            for (const rule of rules) {
                const conditionsMet = rule.conditions.every(cond => evaluateCondition(postContext, cond));
                if (conditionsMet) {
                    const exceptionMet = rule.exceptions?.some(exc => evaluateCondition(postContext, exc.condition));
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
            const { sentiment = 0, voteImpact = 0, wordBoost = [], wordSuppress = [] } = scoring;
            if (wordBoost) wordBoost.forEach(item => {
                if (postContext.text_body.toLowerCase().includes(item.word.toLowerCase()))
                    score += item.value || 10;
            });
            if (wordSuppress) wordSuppress.forEach(item => {
                if (postContext.text_body.toLowerCase().includes(item.word.toLowerCase()))
                    score += item.value || -10;
            });
            if (sentiment !== undefined && typeof post.dataValues.sentiment === 'number') {
                const sentimentDistance = Math.abs(post.dataValues.sentiment - sentiment);
                score += (1 - sentimentDistance) * 10;
            }
            if (voteImpact && typeof post.dataValues.vote_impact === 'number') {
                score = score * (post.upvotes / post.downvotes) * ((post.upvotes + post.downvotes) / post.views) * voteImpact;
            }
            processedPosts.push({
                ...post.dataValues,
                created_at: post.created_at,
                has_images: postContext.has_images,
                has_interactive: postContext.has_interactive,
                has_text: postContext.has_text,
                has_videos: postContext.has_videos,
                score,
                text_body: postContext.text_body
            });
        }
        processedPosts.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            const { chronology = 'newest' } = algorithm;
            return chronology === 'oldest' ? dateA - dateB : dateB - dateA;
        });
        const selectionLimit = limit ? parseInt(limit, 20) : 20;
        const normalizeScores = (items) => {
            const maxScore = Math.max(...items.map(i => i.score), 0);
            return items.map(i => ({ ...i, normScore: maxScore > 0 ? i.score / maxScore : 0 }));
        };
        const getTokens = (text) => (String(text || '').toLowerCase().split(/\W+/).filter(Boolean));
        const jaccardSimilarity = (aTokens, bTokens) => {
            const aSet = new Set(aTokens);
            const bSet = new Set(bTokens);
            const intersection = [...aSet].filter(x => bSet.has(x)).length;
            const unionSize = new Set([...aSet, ...bSet]).size;
            return unionSize === 0 ? 0 : intersection / unionSize;
        };
        const similarityBetween = (p1, p2) => {
            const textSim = jaccardSimilarity(getTokens(p1.text_body), getTokens(p2.text_body));
            const mediaTypes = ['has_images', 'has_interactive', 'has_text', 'has_videos'];
            let sameCount = 0;
            for (const t of mediaTypes) if (p1[t] && p2[t]) sameCount++;
            const mediaSim = sameCount / mediaTypes.length;
            return 0.7 * textSim + 0.3 * mediaSim;
        };
        const mmrSelect = (candidates, k, varietyVal) => {
            const candNorm = normalizeScores(candidates);
            const selected = [];
            while (selected.length < k && candNorm.length) {
                if (!selected.length) {
                    let bestIdx = 0;
                    for (let i = 1; i < candNorm.length; i++) if (candNorm[i].normScore > candNorm[bestIdx].normScore) bestIdx = i;
                    selected.push(candNorm.splice(bestIdx, 1)[0]);
                    continue;
                }
                let bestIdx = 0;
                let bestScore = -Infinity;
                for (let i = 0; i < candNorm.length; i++) {
                    const cand = candNorm[i];
                    let maxSim = 0;
                    for (const s of selected) {
                        const sim = similarityBetween(cand, s);
                        if (sim > maxSim) maxSim = sim;
                    }
                    const relevanceWeight = 1 - varietyVal;
                    const diversityWeight = varietyVal;
                    const mmrScore = relevanceWeight * cand.normScore - diversityWeight * maxSim;
                    if (mmrScore > bestScore) { bestScore = mmrScore; bestIdx = i; }
                }
                selected.push(candNorm.splice(bestIdx, 1)[0]);
            }
            return selected;
        };
        const finalPosts = mmrSelect(processedPosts, selectionLimit, Math.max(0, Math.min(1, variety)));
        console.log("Final selected posts", finalPosts);
        if (!finalPosts.length) return [];
        const finalIds = finalPosts.map(p => p.post_id);
        const savedRows = saverId ? await SavedPosts.findAll({
            attributes: ['post_id'],
            raw: true,
            where: { post_id: { [Op.in]: finalIds }, saver_id: saverId }
        }) : [];
        const savedSet = new Set(savedRows.map(s => s.post_id));
        return finalPosts.map(p => {
            const { score, ...rest } = p;
            return { ...rest, is_saved: savedSet.has(p.post_id) };
        });
    } catch (error){
        console.error("Error in ApplyAlgorithm:", error);
        return [];
    }
}

export { ApplyAlgorithm };