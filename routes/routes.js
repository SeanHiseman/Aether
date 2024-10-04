import authenticateCheck from '../functions/checks/authenticateCheck.js';
import calculatePoints from '../functions/postPoints.js';
import checkIfFollowing from '../functions/checks/followerCheck.js';
import { hybridRecommendations } from '../functions/recommendation/hybrid.js';
import sortPostsByWeightedRatio from '../functions/postSorting.js';
import { Posts, PostNotes, PostVotes } from '../models/content.js'; 
import { Feeds, Followers, FollowRequests } from '../models/feeds.js'; 
import { Connections } from '../models/messages.js'; 
import { Users } from '../models/users.js'; 
import { Op } from 'sequelize';
import { Router } from 'express';

const router = Router();
const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'date_created', 'type', 'is_group', 'feed_owner'];
const notesAttributes = ['note_id', 'note_content', 'timestamp', 'is_misinfo'];
const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp', 'poster_id', 'points'];

router.get('/connection_posts/:feedId', authenticateCheck, async (req, res)=> {
    try {
        const feedId = req.params.feedId;
        const connections = await Connections.findAll({
            where: {[Op.or]: [
                { feed1_id: feedId },
                { feed2_id: feedId }
            ]},
            attributes: ['feed1_id', 'feed2_id']
        });
        //Get connection IDs, since the feed might be in either column
        const connectionIds = connections.reduce((acc, connection) => {
            if (connection.feed1_id !== feedId && !acc.includes(connection.feed1_id)) acc.push(connection.feed1_id);
            if (connection.feed2_id !== feedId && !acc.includes(connection.feed2_id)) acc.push(connection.feed2_id);
            return acc;
        }, []);
        const posts = await Posts.findAll({
            where: { poster_id: { [Op.in]: connectionIds }},
            include: [{
                model: Feeds,
                as: 'poster',
                attributes: feedAttributes,
            }, {
                model: PostVotes,
                as: 'postVotes',
                attributes: ['vote_count'],
                required: false
            }, {
                model: PostNotes,
                as: 'note',
                attributes: notesAttributes,
                required: false
            }],
            attributes: postAttributes,
            //Posts sorted chronilogically
            order: [['timestamp', 'DESC']]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ success: false });   
    }
});

router.get('/following_posts/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const followedFeeds = await Followers.findAll({
            where: { follower_id: feedId },
            include: [{
                model: Feeds,
                attributes: feedAttributes,
            }],
            attributes: [],
        });
        const feedIds = followedFeeds.map((f) => f.feed.feed_id);
        const followedPosts = await Posts.findAll({
            where: { feed_id: { [Op.in]: feedIds } },
            include: [{
                model: PostVotes,
                as: 'postVotes',
                attributes: ['vote_count'],
                required: false
            }, {
                model: PostNotes,
                as: 'note',
                attributes: notesAttributes,
                required: false
            }],
            attributes: postAttributes,
        });
        //const sortedPosts = await sortPostsByWeightedRatio(posts, userId);
        res.json(followedPosts);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Get recommendation preference
router.get('/get_filter_preference', async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await Users.findByPk(userId, {
            attributes: ['collaborative_preference'],
        });
        res.json({ preference: user.recommendation_preference });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Get recommendation preference
router.get('/get_time_preference', async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await Users.findByPk(userId, {
            attributes: ['time_preference'],
        });
        res.json({ preference: user.time_preference });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Accesses recommendation algorithm to provide content
router.get('/recommended_posts', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await Users.findByPk(userId);
        const recommendations = await hybridRecommendations(user);
        const sortedPosts = await sortPostsByWeightedRatio(recommendations, userId);
        //Logs scores
        //sortedPosts.forEach((post) => {
            //console.log(post.title, post.score);
        //});
        res.status(200).json(sortedPosts);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/search/feeds/:searcherId', authenticateCheck, async (req, res) => {
    try {
        const searcherId = req.params.searcherId;
        const keyword = req.query.keyword.toLowerCase();
        const feeds = await Feeds.findAll({
            where: { feed_name: { [Op.like]: `%${keyword}%` } },
            attributes: feedAttributes,
        });
        const feedData = await Promise.all(feeds.map(async (feed) => {
            const isFollowing = await checkIfFollowing(searcherId, feed.feed_id);
            const isRequestSent = await FollowRequests.findOne({
                where: {
                    sender_id: searcherId,
                    receiver_id: feed.feed_id
                }
            });
            return {
                ...feed.toJSON(),
                isFollowing,
                isRequestSent: !!isRequestSent
            };
        }));
        res.json(feedData);
    } catch (error) {
        res.status(500).json({ success: false }); 
    }
});

//Searches posts
router.get('/search/posts/:searcherId', authenticateCheck, async (req, res) => {
    try {
        const keyword = req.query.keyword.toLowerCase();
        const searcherId = req.session.searcherId;
        const postResults = await Posts.findAll({
            where: {
                [Op.or]: [{
                    title: {[Op.like]: `%${keyword}%`},
                }, {content: {[Op.like]: `%${keyword}%`,}}
            ]},
            include: [{
                model: Feeds, 
                as: 'poster',
                attributes: postAttributes,
            }, {
                model: PostVotes,
                as: 'postVotes',
                attributes: ['vote_count'],
                required: false
            }, {
                model: PostNotes,
                as: 'note',
                attributes: notesAttributes,
                required: false
            }],
            attributes: postAttributes,
        });
        //const sortedPosts = await sortPostsByWeightedRatio(postResults, searcherId);
        res.json(postResults);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Update recommendation preference
router.post('/set_filter_preference', async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { preference } = req.body;
        const user = await Users.findByPk(userId);
        user.collaborative_preference = preference;
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Update time preference
router.post('/set_time_preference', async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { preference } = req.body;
        const user = await Users.findByPk(userId);
        user.time_preference = preference;
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

export default router;



