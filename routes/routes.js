import authenticateCheck from '../functions/checks/authenticateCheck.js';
import calculatePoints from '../functions/postPoints.js';
import ConnectCheck from '../functions/checks/connectCheck.js';
import FollowerCheck from '../functions/checks/followerCheck.js';
import { hybridRecommendations } from '../functions/recommendation/hybrid.js';
import sequelize from '../databaseSetup.js';
import sortPostsByWeightedRatio from '../functions/postSorting.js';
import { Connections, ConnectRequests, Feeds, FeedChannels, Followers, FollowRequests, Posts, PostNotes, PostVotes } from '../models/relationships.js'; 
import { Users } from '../models/users.js'; 
import { Op } from 'sequelize';
import { Router } from 'express';

const router = Router();
const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'created_at', 'updated_at', 'type', 'is_group', 'feed_owner', 'is_locked'];
const notesAttributes = ['note_id', 'note_content', 'created_at', 'updated_at', 'is_misinfo'];
const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'created_at', 'updated_at', 'poster_id', 'points'];
const posterAttributes = ['feed_id', 'feed_name', 'description', 'feed_photo', 'type', 'is_group'];

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
                attributes: ['upvotes', 'downvotes'],
                required: false
            }, {
                model: PostNotes,
                as: 'note',
                attributes: notesAttributes,
                required: false
            }],
            attributes: postAttributes,
            //Posts sorted chronilogically
            order: [['created_at', 'DESC']]
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
                attributes: ['upvotes', 'downvotes'],
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

//Searches posts and feeds together
router.get('/search/:searcherId', async (req, res) => { 
    try {
        const searcherId = req.params.searcherId;
        const keyword = req.query.keyword ? req.query.keyword.toLowerCase() : '';
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const feeds = await Feeds.findAll({
            where: { feed_name: { [Op.like]: `%${keyword}%` } },
            attributes: feedAttributes, 
            limit,
            offset
        });
        const feedData = await Promise.all(feeds.map(async (feed) => {
            const feedJSON = feed.toJSON();
            const response = {
                ...feedJSON,
                isAdmin: false,
                isMod: false,
                isFollower: false,
            };
            const followStatus = await FollowerCheck(searcherId, feed.feed_id);
            response.isAdmin = followStatus?.isAdmin || false;
            response.isMod = followStatus?.isMod || false;
            response.isFollower = followStatus?.following || false;
            if (!feed.is_group) {
                const [connectStatus, connectRequest] = await Promise.all([
                    ConnectCheck(searcherId, feed.feed_id),
                    ConnectRequests.findOne({
                        where: {
                            [Op.or]: [
                                { sender_id: searcherId, receiver_id: feed.feed_id },
                                { sender_id: feed.feed_id, receiver_id: searcherId }
                            ]
                        }
                    })
                ]);
                response.isConnected = connectStatus?.connected || false;
                response.connectRequest = connectRequest || null;
            }
            if (feed.type === 'private') {
                const followRequest = await FollowRequests.findOne({
                    where: { sender_id: searcherId, receiver_id: feed.feed_id }
                });
                response.followRequest = followRequest || null;
            }
            return response;
        }));
        //Needs adjusting
        const postResults = await sequelize.query(`
            SELECT p.*, 
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(p.content, '<head>.*?</head>', ''),
                            '<title>.*?</title>', ''
                        ), 
                        '<script.*?</script>', ''
                    ), 
                    '<[^>]*>', ''
                ) AS clean_content
            FROM posts p
            JOIN feeds f ON p.feed_id = f.feed_id
            WHERE 
                (p.title LIKE :keyword
                OR REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(p.content, '<title>.*?</title>', ''), 
                        '<script.*?</script>', ''
                    ), 
                    '<[^>]*>', ''
                ) LIKE :keyword)
                AND f.type != 'private'
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        `, {
            replacements: { 
                keyword: `%${keyword}%`,
                limit: limit,
                offset: offset
            },
            type: sequelize.QueryTypes.SELECT
        });       
        const processedPosts = await Promise.all(postResults.map(async (post) => {
            const feed = await Feeds.findByPk(post.feed_id, {
                attributes: feedAttributes
            });
            const note = await PostNotes.findOne({
                where: { post_id: post.post_id },
                attributes: notesAttributes
            });
            const parentChannel = await FeedChannels.findByPk(post.channel_id, {
                attributes: ['channel_id', 'channel_name']
            });
            const poster = await Feeds.findByPk(post.feed_id, {
                attributes: posterAttributes
            });
            const postVotes = await PostVotes.findAll({
                where: { post_id: post.post_id },
                attributes: ['upvotes', 'downvotes']
            });
            return {
                ...post,
                feed,
                note,
                parentChannel,
                poster,
                postVotes,
            };
        }));
        res.status(200).json({ 
            feeds: feedData, 
            posts: processedPosts,
            success: true 
        });
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



