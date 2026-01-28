import { computeAlgorithmScore } from "./computeAlgorithmScore.js";
import { ExternalPosts } from "../../models/content.js";
import { Posts } from "../../models/relationships.js";
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