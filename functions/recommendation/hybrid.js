const combineRecommendations = (collaborativeRecommendations, contentRecommendations) => {
    const hybridRecommendations = [];

    const normaliseScores = (recommendations) =>
        recommendations.map(({ post, score }) => ({
            post,
            score: (score - Math.min(...recommendations.map(({ score }) => score))) /
                (Math.max(...recommendations.map(({ score }) => score)) -
                Math.min(...recommendations.map(({ score }) => score))),
        }));

    const normalisedCollaborativeRecommendations = normaliseScores(collaborativeRecommendations);
    const normalisedContentRecommendations = normaliseScores(contentRecommendations);

    const collaborativeWeight = 0.6;
    const contentWeight = 0.4;

    for (const { post: collaborativePost, score: collaborativeScore } of normalisedCollaborativeRecommendations) {
        const contentRecommendation = normalisedContentRecommendations.find(
            ({ post }) => post.post_id === collaborativePost.post_id
        );

        if (contentRecommendation) {
            const { score: contentScore } = contentRecommendation;
            const hybridScore = collaborativeWeight * collaborativeScore + contentWeight * contentScore;
            hybridRecommendations.push({ post: collaborativePost, score: hybridScore });
        } else {
            hybridRecommendations.push({ post: collaborativePost, score: collaborativeScore});
        }
    }

    hybridRecommendations.sort((a, b) => b.score - a.score);
    return hybridRecommendations.slice(0, 10); //Retuns top 10 results
};

export default combineRecommendations;
