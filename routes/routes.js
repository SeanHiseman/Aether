import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import ConnectCheck from '../functions/checks/connectCheck.js';
import FollowerCheck from '../functions/checks/followerCheck.js';
import { ConnectRequests, Feeds, FeedChannels, FollowRequests, PostNotes, PostVotes } from '../models/relationships.js'; 
import { Op } from 'sequelize';
import { Router } from 'express';

const router = Router();
const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'created_at', 'updated_at', 'type', 'is_group', 'feed_owner', 'is_locked'];
const notesAttributes = ['note_id', 'note_content', 'created_at', 'updated_at', 'is_misinfo'];
const posterAttributes = ['feed_id', 'feed_name', 'description', 'feed_photo', 'type', 'is_group'];

//Searches posts and feeds together
router.get('/search/:searcherId', async (req, res) => { 
    try {
        const searcherId = req.params.searcherId;
        const keyword = req.query.keyword ? req.query.keyword.toLowerCase() : '';
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const userId = searcherId; 
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
            if (!feed.is_group) { //Can only send connect requests to individuals
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
        const publicFeeds = await Feeds.findAll({
            where: { type: { [Op.ne]: 'private' } },
            attributes: ['feed_id']
        });
        let allPosts = [];
        for (const feed of publicFeeds.slice(0, 20)) { 
            const includeOptions = [{
                model: Feeds,
                as: 'poster',
                attributes: feedAttributes
            }, {
                model: PostNotes,
                as: 'note',
                attributes: notesAttributes
            }, {
                model: FeedChannels,
                as: 'parentChannel',
                attributes: ['channel_id', 'channel_name']
            }, {
                model: Feeds,
                as: 'poster',
                attributes: posterAttributes
            }, {
                model: PostVotes,
                as: 'votes',
                attributes: ['upvotes', 'downvotes']
            }];
            const feedPosts = await ApplyAlgorithm({
                locationId: 'search',
                excludedPostIds: '',
                feedId: feed.feed_id,
                includeOptions: includeOptions,
                isMain: 'false',
                limit: Math.ceil(limit / Math.min(publicFeeds.length, 20)),
                offset: 0,
                saverId: searcherId,
                userId: userId
            });
            const filteredPosts = feedPosts.filter(post => {
                const titleMatch = post.title && post.title.toLowerCase().includes(keyword);
                const contentMatch = post.text_body && post.text_body.toLowerCase().includes(keyword);
                return titleMatch || contentMatch;
            });
            allPosts.push(...filteredPosts);
        }
        allPosts.sort((a, b) => {
            const aInTitle = a.title && a.title.toLowerCase().includes(keyword);
            const bInTitle = b.title && b.title.toLowerCase().includes(keyword);
            if (aInTitle && !bInTitle) return -1;
            if (!aInTitle && bInTitle) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });
        const processedPosts = allPosts.slice(offset, offset + limit);
        res.status(200).json({ feeds: feedData, posts: processedPosts, success: true });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false });
    }
});

export default router;