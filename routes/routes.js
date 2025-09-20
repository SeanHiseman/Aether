import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import ConnectCheck from '../functions/checks/connectCheck.js';
import FollowerCheck from '../functions/checks/followerCheck.js';
import { ConnectRequests, Feeds, FeedChannels, FollowRequests, PostNotes, PostVotes } from '../models/relationships.js'; 
import { Op } from 'sequelize';
import { Router } from 'express';

const router = Router();

//Searches posts and feeds together
router.get('/search', async (req, res) => { 
    try {
        const searcherId = req.session.viewer_id;
        const keyword = req.query.keyword ? req.query.keyword.toLowerCase() : '';
        const limit = parseInt(req.query.limit, 10) || 48;
        const feedOffset = parseInt(req.query.feedOffset, 10) || 0;
        const postOffset = parseInt(req.query.postOffset, 10) || 0;
        const feeds = await Feeds.findAll({
            where: { feed_name: { [Op.like]: `%${keyword}%` } },
            limit,
            offset: feedOffset
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
            if (!feed.is_group && searcherId) { //Can only send connect requests to individuals
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
            if (feed.type === 'private' && searcherId) {
                const followRequest = await FollowRequests.findOne({
                    where: { sender_id: searcherId, receiver_id: feed.feed_id }
                });
                response.followRequest = followRequest || null;
            }
            return response;
        }));
        const includeOptions = [{
            model: Feeds,
            as: 'poster',
        }, {
            model: PostNotes,
            as: 'note',
        }, {
            model: FeedChannels,
            as: 'parentChannel',
            attributes: ['channel_id', 'channel_name']
        }, {
            model: Feeds,
            as: 'poster',
        }, {
            model: PostVotes,
            as: 'votes',
            attributes: ['upvotes', 'downvotes']
        }];
        const postResults = await ApplyAlgorithm({
            locationId: 'search',
            excludedPostIds: '',
            feedId: null, //Not used when locationId is 'search'
            includeOptions: includeOptions,
            isMain: 'false',
            limit: limit,
            offset: postOffset,
            viewerId: searcherId,
            keyword: keyword
        });
        res.status(200).json({ feeds: feedData, posts: postResults, success: true });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false });
    }
});

export default router;