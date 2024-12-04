import { Posts, PostVotes } from "../../models/content.js";
import { Feeds } from "../../models/feeds.js";
import { Connections } from "../../models/messages.js";
import { Op } from 'sequelize';

const pearsonCorrelation = (feed1Votes, feed2Votes) => {
    const ratings1 = feed1Votes.reduce((acc, vote) => {
        acc[vote.content_id] = vote.vote_count;
        return acc;
    }, {});
    const ratings2 = feed2Votes.reduce((acc, vote) => {
        acc[vote.content_id] = vote.vote_count;
        return acc;
    }, {});
    const commonPostIds = Object.keys(ratings1).filter(postId => ratings2.hasOwnProperty(postId));
    if (commonPostIds.length === 0) return 0;
    let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
    for (const postId of commonPostIds) {
        const r1 = ratings1[postId];
        const r2 = ratings2[postId];
        sum1 += r1;
        sum2 += r2;
        sum1Sq += r1 * r1;
        sum2Sq += r2 * r2;
        pSum += r1 * r2;
    }
    const num = pSum - (sum1 * sum2 / commonPostIds.length);
    const denominator = Math.sqrt((sum1Sq - sum1 * sum1 / commonPostIds.length) * (sum2Sq - sum2 * sum2 / commonPostIds.length));
    return denominator === 0 ? 0 : num / denominator;
};

const findFriendVotes = async (user) => {
    const connections = await Connections.findAll({
        where: {
            [Op.or]: [
                { feed1_id: user.user_id },
                { feed2_id: user.user_id }
            ]
        },
        attributes: ['feed1_id', 'feed2_id'],
    });
    const connectionIds = connections.reduce((ids, friend) => {
        if (friend.user1_id === user.user_id) ids.push(friend.user2_id);
        if (friend.user2_id === user.user_id) ids.push(friend.user1_id);
        return ids;
    }, []);
    const userUpvotes = await PostVotes.findAll({
        where: { user_id: { [Op.in]: connectionIds }, vote_count: { [Op.gt]: 0 } },
        include: [
            { model: Posts, as: 'Post' },
        ],
    });
    const similarityScores = {};
    //Calculate similarity scores between the user and their friends
    const otherUsers = await Feeds.findAll({
        where: { user_id: { [Op.ne]: user.user_id } },
        include: [
            { model: PostVotes, as: 'content_vote', where: { user_id: { [Op.in]: friendIds }, vote_count: { [Op.gt]: 0 } } },
            { model: Posts, as: 'Poster' },
        ],
    });
    for (const otherUser of otherUsers) {
        const otherUserUpvotes = otherUser.content_vote.filter(vote => vote.vote_count > 0 );
        const similarityScore = pearsonCorrelation(userUpvotes, otherUserUpvotes);
        similarityScores[otherUser.user_id] = similarityScore;
    }
    //Sort friends by similarity score and return the most similar friends
    const sortedUsers = Object.entries(similarityScores).sort((a, b) => b[1] - a[1]);
    const topSimilarUsers = sortedUsers.map(([userId, score]) => ({
        userId,
        score,
    }));
    return topSimilarUsers; 
};

const similarUserRecommendations = async (similarUsers) => {
    const recommendations = [];
    for (const { userId, score } of similarUsers) {
        const user = await Feeds.findByPk(userId, {
            include: [{
                model: PostVotes,
                as: 'content_vote',
                where: { vote_count: { [Op.gt]: 0 } },
                include: [
                    { model: Posts, as: 'Post' },
                ]},
            ],
        });
        user.content_vote.forEach(vote => {
            if (vote.Post) {
                recommendations.push({
                    ...vote.ProfilePost.dataValues,
                    is_group: false,
                    score
                });
            }
        });
    }
    return recommendations;
};

export { findFriendVotes, similarUserRecommendations };