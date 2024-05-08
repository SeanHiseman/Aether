import { findFriendVotes, similarUserRecommendations } from './collaborative.js';
import { userInteractionRecommendations } from './contentBased.js';

const hybridRecommendations = async (user) => {
    const collaborativeWeight = user.collaborative_preference;
    const contentBasedWeight = 1 - collaborativeWeight;
    const collaborativeRecommendations = await similarUserRecommendations(await findFriendVotes(user));
    //console.log("collaborativeRecommendations:", collaborativeRecommendations);
    const contentBasedRecommendations = await userInteractionRecommendations(user);
    let combinedRecommendations = {};

    for (const recommendation of collaborativeRecommendations) {
        if (!combinedRecommendations[recommendation.post_id]) {
            combinedRecommendations[recommendation.post_id] = {
                ...recommendation,
                score: 0,
            };
        }
        combinedRecommendations[recommendation.post_id].score += recommendation.score * collaborativeWeight; 
    }

    for (const recommendation of contentBasedRecommendations) {
        if (!combinedRecommendations[recommendation.post_id]) {
            combinedRecommendations[recommendation.post_id] = {
                ...recommendation,
                score: 0,
            };
        }
        combinedRecommendations[recommendation.post_id].score += recommendation.score * contentBasedWeight; 
    }

    const finalRecommendations = Object.values(combinedRecommendations)
        .sort((a, b) => b.score - a.score);

    //finalRecommendations.forEach((post) => {
        //console.log(post.title, post.score);
    //});
    return finalRecommendations;
};

export { hybridRecommendations };

