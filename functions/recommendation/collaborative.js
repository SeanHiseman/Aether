import { ContentVotes, Friends, GroupPosts, ProfilePosts, Users } from "../../models/models.js";
import { Op } from 'sequelize';

const pearsonCorrelation = (user1Votes, user2Votes) => {
    const ratings1 = user1Votes.reduce((acc, vote) => {
        acc[vote.content_id] = vote.vote_count;
        return acc;
    }, {});
    const ratings2 = user2Votes.reduce((acc, vote) => {
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
    //Finds all of a users friends
    const friends = await Friends.findAll({
        where: {
            [Op.or]: [
                { user1_id: user.user_id },
                { user2_id: user.user_id }
            ]
        },
        attributes: ['user1_id', 'user2_id'],
    });

    const friendIds = friends.reduce((ids, friend) => {
        if (friend.user1_id === user.user_id) ids.push(friend.user2_id);
        if (friend.user2_id === user.user_id) ids.push(friend.user1_id);
        return ids;
    }, []);

    const userUpvotes = await ContentVotes.findAll({
        where: { user_id: { [Op.in]: friendIds }, vote_count: { [Op.gt]: 0 } },
        include: [
            { model: ProfilePosts, as: 'ProfilePost' },
            { model: GroupPosts, as: 'GroupPost' },
        ],
    });
  
    const similarityScores = {};

    //Calculate similarity scores between the user and their friends
    const otherUsers = await Users.findAll({
        where: { user_id: { [Op.ne]: user.user_id } },
        include: [
            { model: ContentVotes, as: 'content_vote', where: { user_id: { [Op.in]: friendIds }, vote_count: { [Op.gt]: 0 } } },
            { model: ProfilePosts, as: 'ProfilePoster' },
            { model: GroupPosts, as: 'GroupPoster' },
        ],
    });
  
    for (const otherUser of otherUsers) {
        const otherUserUpvotes = otherUser.content_vote.filter(vote => vote.vote_count > 0 );
        //console.log("otherUserUpvotes:", otherUserUpvotes);
        const similarityScore = pearsonCorrelation(userUpvotes, otherUserUpvotes);
        //console.log("similarityScore", similarityScore);
        similarityScores[otherUser.user_id] = similarityScore;
    }

    //Sort friends by similarity score and return the most similar friends
    const sortedUsers = Object.entries(similarityScores).sort((a, b) => b[1] - a[1]);
    const topSimilarUsers = sortedUsers.map(([userId, score]) => ({
        userId,
        score,
    }));
    //console.log("topSimilarUsers:", topSimilarUsers);
    return topSimilarUsers; 
};

const similarUserRecommendations = async (similarUsers) => {
    const recommendations = [];
  
    for (const { userId, score } of similarUsers) {
        const user = await Users.findByPk(userId, {
            include: [{
                model: ContentVotes,
                as: 'content_vote',
                where: { vote_count: { [Op.gt]: 0 } },
                include: [
                    { model: ProfilePosts, as: 'ProfilePost' },
                    { model: GroupPosts, as: 'GroupPost' }
                ]},
            ],
        });

        user.content_vote.forEach(vote => {
            if (vote.ProfilePost) {
                recommendations.push({
                    ...vote.ProfilePost.dataValues,
                    //ProfilePoster: {
                        //username: vote.ProfilePost.ProfilePoster.username,
                        //profile: vote.ProfilePost.ProfilePoster 
                    //},
                    is_group: false,
                    score
                });
            }
            if (vote.GroupPost) {
                recommendations.push({
                    ...vote.GroupPost.dataValues,
                    //GroupPoster: {
                        //username: vote.GroupPost.GroupPoster.username,
                        //profile: vote.GroupPost.GroupPoster 
                    //},
                    is_group: true,
                    score
                });
            }
        });
    }
    //Checks scores
    //recommendations.forEach((post) => {
        //console.log("collaborative:", post.title, post.score);
    //});
    //console.log("recommendations:", recommendations);
    return recommendations;
};

export { findFriendVotes, similarUserRecommendations };