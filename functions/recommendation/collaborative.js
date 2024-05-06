import { ContentVotes, GroupPosts, ProfilePosts, Users } from "../../models/models.js";
import { Op } from 'sequelize';

const findSimilarUsers = async (user) => {
    const userUpvotes = await ContentVotes.findAll({
        where: { user_id: user.user_id, vote_count: 1 },
        include: [
            { model: ProfilePosts, as: 'ProfilePost' },
            { model: GroupPosts, as: 'GroupPost' },
        ],
    });
  
    const similarityScores = {};

    //Calculate similarity scores between the user and other users
    const otherUsers = await Users.findAll({
        where: { user_id: { [Op.ne]: user.user_id } },
        include: [
            { model: ContentVotes, as: 'content_vote', where: { vote_count: 1 } },
            { model: ProfilePosts, as: 'ProfilePoster' },
            { model: GroupPosts, as: 'GroupPoster' },
        ],
    });
  
    for (const otherUser of otherUsers) {
        const otherUserUpvotes = otherUser.content_vote.filter(vote => vote.vote_count === 1);
        const similarityScore = pearsonCorrelation(userUpvotes, otherUserUpvotes);
        similarityScores[otherUser.user_id] = similarityScore;
    }
  
    // Sort users by similarity score and return the most similar users
    const sortedUsers = Object.entries(similarityScores).sort((a, b) => b[1] - a[1]);
    const topSimilarUsers = sortedUsers.slice(0, 10).map(([userId, score]) => ({
        userId,
        score,
    }));
  
    return topSimilarUsers; 
};

const pearsonCorrelation = (user1Upvotes, user2Upvotes) => {
    const user1UpvotedPostIds = new Set(user1Upvotes.map(({ content_id }) => content_id));
    const user2UpvotedPostIds = new Set(user2Upvotes.map(({ content_id }) => content_id));
  
    const commonPostIds = new Set([...user1UpvotedPostIds].filter(post_id => user2UpvotedPostIds.has(post_id)));
    
    let numerator = 0;
    let user1Sum = 0;
    let user2Sum = 0;
    let user1SquaredSum = 0;
    let user2SquaredSum = 0;
  
    for (const postId of commonPostIds) {
        const user1Rating = user1UpvotedPostIds.has(postId) ? 1 : 0;
        const user2Rating = user2UpvotedPostIds.has(postId) ? 1 : 0;
    
        numerator += user1Rating * user2Rating;
        user1Sum += user1Rating;
        user2Sum += user2Rating;
        user1SquaredSum += user1Rating ** 2;
        user2SquaredSum += user2Rating ** 2;
    }
  
    const n = commonPostIds.size;
  
    const denominator1 = Math.sqrt(user1SquaredSum - (user1Sum ** 2) / n);
    const denominator2 = Math.sqrt(user2SquaredSum - (user2Sum ** 2) / n);
  
    if (denominator1 === 0 || denominator2 === 0) {
        return 0;
    }
  
    return numerator / (n * denominator1 * denominator2);   
};

const similarUserRecommendations = async (similarUsers) => {
    const recommendations = [];
  
    for (const { userId, score } of similarUsers) {
        const user = await Users.findByPk(userId, {
            include: [
                { model: ProfilePosts, as: 'ProfilePoster' },
                { model: GroupPosts, as: 'GroupPoster' },
            ],
        });
    
        const userUpvotedPosts = [
            ...(vote.ProfilePost ? [vote.ProfilePost] : []),
            ...(vote.GroupPost ? [vote.GroupPost] : []),
        ];
    
        recommendations.push(...userUpvotedPosts.map((post) => ({ post, score })));
    }  
    return recommendations;
};

export { findSimilarUsers, similarUserRecommendations };