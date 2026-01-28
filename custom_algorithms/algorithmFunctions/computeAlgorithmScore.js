import { fastCosineSimilarity } from "./fastCosineSimilarity.js";

//Computes algorithm score for a single post
export function computeAlgorithmScore(post, { algorithmRow, normalizedBoost, normalizedSuppress, voteImpact, sentiment, variety, normalisedRecentEmbeddings, recentUpvotePosts, recentWeights, totalWeight, timeLimits }) {
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
    //Recency boost - heavily favor recent posts
    const postTime = new Date(post.created_at || post.created_at_remote).getTime();
    const ageInHours = (Date.now() - postTime) / (1000 * 60 * 60);
    //Exponential decay favoring posts from the last 24 hours
    const recencyBoost = 20 * Math.exp(-ageInHours / 12);
    algorithmScore += recencyBoost;
    return algorithmScore;
}