import { computeAlgorithmScore } from "./computeAlgorithmScore.js";
import { ExternalPosts, ExternalAccountMeta } from "../../models/content.js";
import { Feeds, Posts } from "../../models/relationships.js";
import { prepareAlgorithmEmbeddings } from "./prepareAlgorithmEmbeddings.js";
import { Op } from "sequelize";

//Scores and paginates candidates from native and/or external sources, returns { paginatedIds, scoreMap } where paginatedIds is the slice for the current page
export async function scoreAndPaginateCandidates({ nativePostIds = [], externalPostIds = [], algorithmRow, scoringParams, offset, limit }) {
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
    const { normalizedBoost, normalizedSuppress, normalizedPolitical } = prepareAlgorithmEmbeddings(algorithmRow);
    //Pre-compute variety weights once
    const { normalisedRecentEmbeddings, recentUpvotePosts, learningRate = 0.5 } = scoringParams;
    const now = Date.now();
    const tenDays = 864000000;
    let recentWeights = [];
    let totalWeight = 0;
    if (recentUpvotePosts && recentUpvotePosts.length > 0) {
        //Learning rate affects how much we favor recent interactions
        //Higher learning rate = more weight on recent interactions
        const decayRate = 1 / (1 + (1 - learningRate) * 5); //0.5 learningRate = normal decay
        recentWeights = recentUpvotePosts.map(p => {
            const age = now - new Date(p.updated_at).getTime();
            return 1 / (1 + (age / tenDays) * decayRate);
        });
        totalWeight = recentWeights.reduce((a, b) => a + b, 0) || 1;
        recentWeights = recentWeights.map(w => w / totalWeight);
    }
    //Build optimized params with pre-computed values
    const optimizedParams = { ...scoringParams, normalizedBoost, normalizedSuppress, normalizedPolitical, recentWeights, totalWeight };
    //Fetch post data with embeddings and account info for scoring
    let nativePosts = [];
    if (limitedNativeIds.length) {
        const rawPosts = await Posts.findAll({
            where: { post_id: { [Op.in]: limitedNativeIds } },
            include: [{
                model: Feeds,
                as: 'poster',
                attributes: ['follower_count'],
                required: false
            }],
            attributes: ['post_id', 'embeddings', 'rank_hotness', 'upvotes', 'downvotes', 'views', 'sentiment_score', 'created_at', 'poster_id', 'feed_id', 'channel_id', 'word_count'],
            raw: false
        });
        nativePosts = rawPosts.map(p => ({
            ...(p.dataValues || p),
            follower_count: p.poster?.follower_count || 0
        }));
    }
    let externalPosts = [];
    if (limitedExternalIds.length) {
        const rawExternal = await ExternalPosts.findAll({
            where: { post_id: { [Op.in]: limitedExternalIds }, content: { [Op.ne]: null } },
            attributes: ['post_id', 'embeddings', 'score', 'sentiment_score', 'created_at_remote', 'author', 'author_did', 'source', 'word_count'],
            raw: true
        });
        //Fetch follower counts for external accounts
        const authorDids = [...new Set(rawExternal.map(p => p.author_did).filter(Boolean))];
        const authorHandles = [...new Set(rawExternal.map(p => p.author).filter(Boolean))];
        let accountMetas = [];
        if (authorDids.length > 0 || authorHandles.length > 0) {
            accountMetas = await ExternalAccountMeta.findAll({
                where: {
                    [Op.or]: [
                        ...(authorDids.length > 0 ? [{ account_id: { [Op.in]: authorDids } }] : []),
                        ...(authorHandles.length > 0 ? [{ handle: { [Op.in]: authorHandles } }] : [])
                    ]
                },
                attributes: ['account_id', 'handle', 'follower_count'],
                raw: true
            });
        }
        const followerMap = new Map();
        for (const meta of accountMetas) {
            if (meta.account_id) followerMap.set(meta.account_id, meta.follower_count || 0);
            if (meta.handle) followerMap.set(meta.handle, meta.follower_count || 0);
        }
        externalPosts = rawExternal.map(p => ({
            ...p,
            follower_count: followerMap.get(p.author_did) || followerMap.get(p.author) || 0
        }));
    }
    //Compute algorithm scores for all candidates
    const scoredCandidates = [];
    const allCandidates = [
        ...nativePosts.map(p => ({ ...p, isExternal: false })),
        ...externalPosts.map(p => ({ ...p, isExternal: true, created_at: p.created_at_remote }))
    ];
    //Track author and source diversity for scoring
    const authorCounts = {};
    const sourceCounts = {};
    let nativeScored = 0;
    let externalScored = 0;
    let nativeFiltered = 0;
    let externalFiltered = 0;
    for (const post of allCandidates) {
        //Track author for diversity
        const authorKey = post.isExternal ? (post.author_did || post.author) : post.poster_id;
        //Track source for diversity (feed_id, channel_id, or external source)
        const sourceKey = post.isExternal ? post.source : (post.channel_id || post.feed_id);
        const scoreResult = computeAlgorithmScore(post, {
            algorithmRow,
            ...optimizedParams,
            authorCounts,
            sourceCounts,
            authorKey,
            sourceKey
        });
        if (scoreResult !== null) {
            //Handle both object (with reasons) and number return values
            const score = typeof scoreResult === 'object' ? scoreResult.score : scoreResult;
            const reasons = typeof scoreResult === 'object' ? scoreResult.reasons : undefined;
            scoredCandidates.push({
                post_id: post.post_id,
                algorithmScore: score,
                isExternal: post.isExternal,
                ...(reasons ? { recommendationReasons: reasons } : {})
            });
            //Update diversity tracking
            if (authorKey) authorCounts[authorKey] = (authorCounts[authorKey] || 0) + 1;
            if (sourceKey) sourceCounts[sourceKey] = (sourceCounts[sourceKey] || 0) + 1;
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