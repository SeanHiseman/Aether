import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import ConnectCheck from '../functions/checks/connectCheck.js';
import { ConnectRequests, Feedback, Feeds, FeedChannels, FollowRequests, PostNotes, PostVotes } from '../models/relationships.js'; 
import FollowerCheck from '../functions/checks/followerCheck.js';
import { Op } from 'sequelize';
import { Router } from 'express';
import Sequelize from 'sequelize';
import { standardLimiter } from '../functions/checks/limiters.js';
import { ValidateTextInput } from '../functions/validateTextInput.js';

const router = Router();

router.post('/feedback', standardLimiter, authenticateCheck, async (req, res) => {
	try {
		const userId = req?.session?.user_id || null;
		const { message } = req.body;
		const messageCheck = ValidateTextInput(message, 1, 5000, false);
		if (!messageCheck.valid) {
			return res.status(400).json({ message: messageCheck.error });
		}
		await Feedback.create({
			user_id: userId,
			message,
		});
		return res.status(200).json({ success: true, message: 'Feedback submitted. Thank you.' });
	} catch (error) {
        console.error(new Date().toISOString(), '/feedback error:', error);
		return res.status(500).json({ message: 'Failed to submit feedback.' });
	}
});

//Searches posts and feeds together
router.post('/search', standardLimiter, async (req, res) => { 
    try {
        const { keyword, limit = 100, feedOffset = 0, postOffset = 0, recentUpvotes } = req.body;
        const trimmedKeyword = (keyword || '').trim();
        if (!trimmedKeyword) {
			return res.status(400).json({ success: false, message: 'Please enter a search term.' });
		}
        const searcherId = req.session.viewer_id;
        const feeds = await Feeds.findAll({
            where: Sequelize.literal(
                `MATCH (feed_name, description) AGAINST (${Feeds.sequelize.escape(keyword)} IN NATURAL LANGUAGE MODE)`
            ),
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
            attributes: ['channel_id', 'channel_name'],
            include: [{
                model: Feeds,
                required: true,
                where: {
                    type: {
                        [Op.ne]: 'private'
                    }
                }
            }],
            required: true
        }, {
            model: PostVotes,
            as: 'votes',
            attributes: ['upvotes', 'downvotes']
        }];
        const algorithmResult = await ApplyAlgorithm({
            locationId: 'search',
            feedId: null,
            includeOptions: includeOptions,
            isMain: 'false',
            limit: limit,
            offset: postOffset,
            recentUpvotes,
            viewerId: searcherId,
            keyword: keyword
        });
        const posts = algorithmResult.posts;
        const message = algorithmResult.message;
        const status = algorithmResult.status;
        res.status(200).json({ feeds: feedData, posts: posts, status: status, message: message, success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/search error:', error);
        res.status(500).json({ success: false });
    }
});

export default router;