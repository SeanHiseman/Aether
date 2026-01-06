import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import ConnectCheck from '../functions/checks/connectCheck.js';
import { ConnectRequests, DeepFeeds, DeepFeedContent, Feeds, FeedChannels, FeedChannelMessages, Followers, FollowRequests, Posts, PostNotes, PostVotes, SavedPosts, SavedPostChannels, Users } from '../models/relationships.js';
import DeleteMedia from '../functions/media_handling/deleteMedia.js';
import { DeleteFromS3, UploadToS3 } from '../functions/media_handling/s3Handling.js';
import dotenv from 'dotenv';
import FollowerCheck from '../functions/checks/followerCheck.js';
import { fileURLToPath } from 'url';
import { GenerateFileName } from '../functions/media_handling/generateFileName.js';
import imageUpload from '../functions/media_handling/imageUpload.js';
import fs from 'fs';
import multer from 'multer';
import { Op } from 'sequelize';
import path from 'path';
import { Router } from 'express';
import sequelize from '../databaseSetup.js';
import { standardLimiter, higherLimiter } from '../functions/checks/limiters.js';
import { v4 } from 'uuid';
import { ValidateTextInput } from '../functions/validateTextInput.js'

dotenv.config();
const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mediaDir = path.join(__dirname, '..', '/media', 'feed_images');
const feedProfileUpload = imageUpload('/media/feed_images', 'new_feed_photo');

const defaultImages = [process.env.DEFAULT_USER_IMAGE, process.env.DEFAULT_GROUP_IMAGE];

const calculateFileSize = (file) => {
    return file.size / (1024 * 1024);
};

const checkProfileStorageLimit = async (req, res, next) => {
    try {
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const maxStorage = user.has_membership ? 25 * 1024 : 100; //30GB for members, 300MB for non-members
        if (user.storage_count >= maxStorage) {
            return res.status(413).json({ success: false, message: `Weekly limit of ${maxStorage}MB exceeded` });
        }
        req.currentUser = user;
        next();
    } catch (error) {
        console.error(new Date().toISOString(), 'checkProfileStorageLimit error:', error);
        return res.status(500).json({ success: false, message: 'Error checking storage limit' });
    }
};

router.post('/accept_follow_request', higherLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { request } = req.body;
        const follow_request = await FollowRequests.findByPk(request.request_id, { transaction });
        await Followers.create({
            follow_id: v4(),
            follower_id: follow_request.sender_id,
            feed_id: follow_request.receiver_id
        }, { transaction });
        await Feeds.increment('follower_count', { where: { feed_id: follow_request.receiver_id }, transaction });
		await Feeds.decrement('follow_requests', { where: { feed_id: follow_request.receiver_id }, transaction });
        await follow_request.destroy({ transaction });
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/accept_follow_request error:', error);
        res.status(500).json({ success: false, message: 'Error accepting request' });
    }
});

router.post('/add_feed_channel', standardLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        let { channelName, feedId, isChat, isPosts, isSaved } = req.body;
        const nameCheck = ValidateTextInput(channelName, 1, 30);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.error });
        }
        //If channel types are not specified
        if (isPosts === false && isChat === false) {
            isPosts = true;
            isChat = true;
        };
        if (isSaved) {
            const saverId = req.session.viewer_id;
            const maxOrderResult = await SavedPostChannels.findOne({
                attributes: [[sequelize.fn('COALESCE', sequelize.fn('MAX', sequelize.col('display_order')), -1), 'maxOrder']],
                where: { saver_id: saverId },
                transaction,
                raw: true
            });
            const nextDisplayOrder = (maxOrderResult ? maxOrderResult.maxOrder : -1) + 1;
            const newChannelData = { 
                channel_id: v4(),
                channel_name: channelName,
                saver_id: saverId,
                display_order: nextDisplayOrder
            };
            const newChannel = await SavedPostChannels.create(newChannelData, { transaction });
            await transaction.commit();
            return res.status(201).json({ success: true, newChannel });
        }
        const maxOrderResult = await FeedChannels.findOne({
            attributes: [[sequelize.fn('COALESCE', sequelize.fn('MAX', sequelize.col('display_order')), -1), 'maxOrder']],
            where: { feed_id: feedId },
            transaction,
            raw: true
        });
        const nextDisplayOrder = (maxOrderResult ? maxOrderResult.maxOrder : -1) + 1;
        const newChannelData = { 
            channel_id: v4(),
            channel_name: channelName,
            feed_id: feedId,
            is_posts: isPosts,
            is_chat: isChat,
            display_order: nextDisplayOrder
        };
        const newChannel = await FeedChannels.create(newChannelData, { transaction });
        await transaction.commit();
        res.status(201).json({ success: true, newChannel });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/add_feed_channel error:', error);
        res.status(500).json({ success: false, message: 'Error adding channel' });
    }
});

router.post('/add_to_deep_feed', higherLimiter, async (req, res) => {
    try {
        const { deepFeedId, feedId } = req.body;
        if (!feedId) {
            return res.status(400).json({ success: false, message: 'Id missing' });
        }
        const content = await DeepFeedContent.create({
            content_id: v4(),
            deep_feed_id: deepFeedId,
            feed_id: feedId || null,
        });
        res.status(201).json({ success: true, content });
    } catch (error) {
        console.error(new Date().toISOString(), '/add_to_deep_feed error:', error);
        res.status(500).json({ success: false, message: 'Error adding to feed' });
    }
});

router.post('/change_channel_name', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { channelId, newChannelName } = req.body;
        const nameCheck = ValidateTextInput(newChannelName, 1, 30);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.error });
        }
        if (newChannelName === 'Main') {
            res.status(401).json({ success: false, message: "Channel can't be called main" })
        } else { 
            await FeedChannels.update(
                { channel_name: newChannelName },
                { where: { channel_id: channelId } }
            );
            res.status(200).json({ success: true });
        }
    } catch (error) {
        console.error(new Date().toISOString(), '/change_channel_name error:', error);
        res.status(500).json({ success: false, message: 'Error changing name' });
    }
});

router.post('/change_deep_feed_name', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { deepFeedId, newName } = req.body;
        const nameCheck = ValidateTextInput(newName, 1, 30);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.error });
        }
        if (newName === 'Following') {
            res.status(401).json({ success: false, message: "Can't be called Following" })
        } else { 
            await DeepFeeds.update(
                { name: newName },
                { where: { deep_feed_id: deepFeedId } }
            );
            res.status(200).json({ success: true });
        }
    } catch (error) {
        console.error(new Date().toISOString(), '/change_deep_feed_name error:', error);
        res.status(500).json({ success: false, message: 'Error changing name' });
    }
});

router.post('/change_description', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { description, feedId } = req.body;
        const descriptionCheck = ValidateTextInput(description, 0, 200, false);
        if (!descriptionCheck.valid) {
            return res.status(400).json({ message: descriptionCheck.error });
        }
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        feed.description = description;
        await feed.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/change_description error:', error);
        res.status(500).json({ success: false, message: 'Error changing description' });
    }
});

router.post('/change_feed_name', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { feed_id, newName } = req.body;
        const nameCheck = ValidateTextInput(newName, 3, 30);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.error });
        }
        const feed = await Feeds.findOne({ where: { feed_id } });
        if (feed.feed_name === newName) {
            return res.status(200).json({ success: true, message: 'Name is unchanged' });
        }
        const existingFeed = await Feeds.findOne({
            where: {
                feed_id: { [Op.ne]: feed_id },
                feed_name: { [Op.like]: newName }
            }
        });
        if (existingFeed) {
            return res.status(409).json({ success: false, message: 'Name already in use' });
        }
        feed.feed_name = newName;
        await feed.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/change_feed_name error:', error);
        res.status(500).json({ success: false, message: 'Error changing name' });
    }
});

router.post('/create_feed', standardLimiter, authenticateCheck, checkProfileStorageLimit, async (req, res) => {
    feedProfileUpload(req, res, async function (error) {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, message: 'File cannot be more than 100MB' });
            }
            return res.status(500).json({ success: false, message: 'Upload error occurred' });
        } else if (error) {
            console.error(new Date().toISOString(), 'file upload failed in /create_feed:', error);
            return res.status(500).json({ success: false, message: 'Upload failed' });
        }
        try {
            const { feedName, type, isGroup, feedOwner, viewerFeedId } = req.body;
            const nameCheck = ValidateTextInput(feedName, 3, 30); //Warning: do not change to 32 or over, or users could name feeds using uuids
            if (!nameCheck.valid) {
                return res.status(400).json({ success: false, message: nameCheck.error });
            }
            const existingFeed = await Feeds.findOne({ where: { feed_name: feedName } });
            if (existingFeed) {
                if (req.file) {
                    if (process.env.NODE_ENV === 'production') {
                        const fileName = GenerateFileName(req.file, "feed-image");
                        await DeleteFromS3(`feed-images/${fileName}`);
                    } else {
                        fs.unlinkSync(req.file.path);
                    }
                }
                return res.status(400).json({ success: false, message: 'Name taken' });
            }
            let feed_photo = process.env.DEFAULT_GROUP_IMAGE;
            if (req.file) {
                const fileSize = calculateFileSize(req.file);
                const user = req.currentUser;
                const maxStorage = user.has_membership ? 30 * 1024 : 300; //Weekly limit of 30GB for members, 300MB for non-members
                if (user.storage_count + fileSize > maxStorage) {
                    if (process.env.NODE_ENV === 'production') {
                        const fileName = GenerateFileName(req.file, 'feed-image');
                        await DeleteFromS3(`feed-images/${fileName}`);
                    } else {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(413).json({ success: false, message: `Weekly limit of ${maxStorage}MB exceeded` });
                }
                if (process.env.NODE_ENV === 'production') {
                    const fileName = GenerateFileName(req.file, 'feed-image');
                    const s3Key = `feed-images/${fileName}`;
                    await UploadToS3(s3Key, req.file.buffer, req.file.mimetype);
                    feed_photo = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
                } else {
                    const fileName = GenerateFileName(req.file, 'feed-image');
                    const localPath = path.join(mediaDir, fileName);
                    if (req.file.path !== localPath) {
                        fs.copyFileSync(req.file.path, localPath);
                    }
                    feed_photo = '/' + path.join('media', 'feed_images', fileName).replace(/\\/g, '/');
                }
                user.storage_count += fileSize;
                await user.save();
            }
            const feed = await Feeds.create({
                feed_id: v4(),
                feed_name: feedName,
                feed_photo,
                follower_count: 1,
                type: type,
                is_group: isGroup,
                feed_owner: feedOwner
            });
            await FeedChannels.create({
                channel_id: v4(),
                channel_name: 'Main',
                feed_id: feed.feed_id,
                is_posts: true,
                is_chat: isGroup ? true : false,
            });
            await Followers.create({
                follow_id: v4(),
                follower_id: viewerFeedId,
                feed_id: feed.feed_id,
                is_mod: true,
                is_admin: true,
            });
            res.status(201).json({ success: true, feed });
        } catch (error) {
            console.error(new Date().toISOString(), '/create_feed:', error);
            if (req.file) {
                try {
                    if (process.env.NODE_ENV === 'production') {
                        const fileName = GenerateFileName(req.file, 'feed-image');
                        await DeleteFromS3(`feed-images/${fileName}`);
                    } else if (req.file.path) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupErr) {
                    console.error(new Date().toISOString(), 'Failed to cleanup file:', cleanupErr);
                }
            }
            res.status(500).json({ success: false, message: 'Failed to create feed' });
        }
    });
});

router.post('/create_deep_feed', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { deepFeedName, feedsToInclude, parentDeepFeedId, viewerId } = req.body;
        const nameCheck = ValidateTextInput(deepFeedName, 1, 30);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.error });
        }
        if (!feedsToInclude || feedsToInclude.length < 2) {
            return res.status(400).json({ success: false, message: 'At least two feeds are required' });
        }
        const deepFeed = await DeepFeeds.create({
            deep_feed_id: v4(),
            owner_id: viewerId,
            name: deepFeedName,
            parent_id: parentDeepFeedId || null
        });
        const contents = feedsToInclude.map(feedId => ({
            content_id: v4(),
            deep_feed_id: deepFeed.deep_feed_id,
            feed_id: feedId
        }));
        await DeepFeedContent.bulkCreate(contents);
        if (parentDeepFeedId) { 
            await DeepFeedContent.destroy({
                where: {
                    deep_feed_id: parentDeepFeedId,
                    feed_id: { [Op.in]: feedsToInclude }
                }
            });
            await DeepFeedContent.create({
                content_id: v4(),
                deep_feed_id: parentDeepFeedId,
                feed_id: null
            });
        }
        res.status(201).json({ success: true, deepFeed, feedsToInclude });
    } catch (error) {
        console.error(new Date().toISOString(), '/create_deep_feed error:', error);
        res.status(500).json({ success: false, message: 'Error creating feed' });
    }
});

router.get('/deep_feed_contents/:deepFeedId', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { deepFeedId } = req.params;
        const contents = await DeepFeedContent.findAll({
            where: { deep_feed_id: deepFeedId },
            include: [{ model: Feeds, as: 'feed' }],
            order: [[{ model: Feeds, as: 'feed' }, 'feed_name', 'ASC']]
        });
        res.status(200).json({ success: true, contents });
    } catch (error) {
        console.error(new Date().toISOString(), '/deep_feed_contents error:', error);
        res.status(500).json({ success: false, message: 'Error getting contents' });
    }
});

router.post('/deep_feed_posts', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { connectedAccounts = [], deepFeedId, followedFeedIds: rawFollowedFeedIds, limit = 100, offset = 0, recentUpvotes } = req.body;
        let followedFeedIds = rawFollowedFeedIds || [];
        if (!Array.isArray(followedFeedIds)) {
            followedFeedIds = [followedFeedIds];
        }
        followedFeedIds = followedFeedIds.map(id => id?.toString().trim()).filter(Boolean);
        const userId = req.session.user_id;
        const viewerId = req.session.viewer_id;
        let deepFeed = null;
        if (deepFeedId === 'following') {
            deepFeed = {
                deep_feed_id: 'following',
                name: 'Following',
                owner_id: 'system',
                parent_id: null,
            };
        } else {
            let lookupDeepFeedId = deepFeedId;
            if (deepFeedId.startsWith('deep_')) {
                lookupDeepFeedId = deepFeedId.replace('deep_', '');
            }
            deepFeed = await DeepFeeds.findByPk(lookupDeepFeedId);
            if (!deepFeed) {
                return res.status(404).json({ error: 'Deep feed not found' });
            }
        }
        const includeOptions = [{
            as: 'note',
            model: PostNotes,
            required: false
        },{
            as: 'parentChannel',
            attributes: ['channel_id', 'channel_name', 'feed_id'],
            include: [{
                model: Feeds
            }],
            model: FeedChannels,
            required: false
        },{
            as: 'poster',
            model: Feeds
        },{
            as: 'votes',
            attributes: ['downvotes', 'upvotes'],
            model: PostVotes,
            required: false
        }];
        const algorithmResult = await ApplyAlgorithm({
            locationId: deepFeedId,
            followedFeedIds,
            includeOptions: includeOptions,
            isGroup: false,
            isMain: false,
            limit,
            offset,
            recentUpvotes,
            viewerId,
            connectedAccounts,
            userId
        });
        const posts = algorithmResult.posts;
        const status = algorithmResult.status;
        const message = algorithmResult.message;
        return res.status(200).json({ deepFeed, posts: posts, status: status, message: message, success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/deep_feed_posts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/delete_deep_feed', standardLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { deepFeedId } = req.body;
        await DeepFeedContent.destroy({
            where: { deep_feed_id: deepFeedId },
            transaction,
        });
        await DeepFeeds.destroy({
            where: { deep_feed_id: deepFeedId },
            transaction,
        });
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/delete_deep_feed error:', error);
        res.status(500).json({ success: false, message: 'Error deleting feed' });
    }
});

router.delete('/delete_follow_request', higherLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { receiverId, senderId } = req.body;
        await FollowRequests.destroy({
            where: { receiver_id: receiverId, sender_id: senderId },
            transaction
        });
        await Feeds.decrement('follow_requests', {
			where: { feed_id: receiverId },
			transaction
		});
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/delete_follow_request error:', error);
        res.status(500).json({ success: false, message: 'Error deleting request' });
    }
});

router.delete('/delete_feed', standardLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { feedId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        if (!feed) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Feed not found' });
        }
        await Feeds.destroy({ where: { feed_id: feedId }, transaction });
        await DeepFeedContent.destroy({ where: { content_id: feedId }, transaction });
        await transaction.commit();
        const feedPhoto = feed.feed_photo;
        if (feedPhoto && !defaultImages.includes(feedPhoto)) {
            DeleteMedia(feedPhoto);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/delete_feed error:', error);
        res.status(500).json({ success: false, message: 'Error deleting feed' });
    }
});

router.delete('/delete_feed_channel', higherLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { channelId } = req.body;
        if (!channelId) {
            return res.status(400).json({ success: false, message: 'Channel ID is required' });
        }
        await FeedChannelMessages.destroy({ where: { channel_id: channelId }, transaction });
        await Posts.destroy({ where: { channel_id: channelId }, transaction });
        const deletedCount = await FeedChannels.destroy({ where: { channel_id: channelId }, transaction });
        if (deletedCount === 0) {
            await transaction.rollback(); 
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/delete_feed_channel error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete channel.' });
    }
});

router.post('/explore_feeds', standardLimiter, async (req, res) => {
	try {
		const { exclude = [], limit: reqLimit, offset: reqOffset } = req.body;
		const viewerId = req.session?.viewer_id;
		const limit = parseInt(reqLimit, 10) || 60;
		const offset = parseInt(reqOffset, 10) || 0;
		let excludeArray = Array.isArray(exclude) ? exclude : [];
		if (viewerId) {
			excludeArray.push(viewerId); 
		}
		const { rows: feeds } = await Feeds.findAndCountAll({
			where: {
				type: { [Op.notIn]: ['private', 'hidden'] },
				is_locked: false,
				feed_id: { [Op.notIn]: excludeArray }
			},
			order: sequelize.literal('RAND()'),
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
			const followStatus = viewerId ? await FollowerCheck(viewerId, feed.feed_id) : null;
			response.isAdmin = followStatus?.isAdmin || false;
			response.isMod = followStatus?.isMod || false;
			response.isFollower = followStatus?.following || false;
			if (viewerId && feed.type === 'private') {
				const followRequest = await FollowRequests.findOne({
					where: { sender_id: viewerId, receiver_id: feed.feed_id }
				});
				response.followRequest = followRequest || null;
			}
			return response;
		}));
		res.status(200).json({ success: true, feeds: feedData, hasMore: feedData.length >= limit });
	} catch (error) {
		console.error(new Date().toISOString(), '/explore_feeds error:', error);
		res.status(500).json({ success: false, message: 'Error while fetching feeds' });
	}
});

router.get('/feed/:feedName', standardLimiter, async (req, res) => {
    try {
        const feedName = req.params.feedName;
        const userId = req.session && req.session.user_id;
        const viewerId = req.session && req.session.feed_id;
        let isAdmin = false,
            isMod = false,
            isConnected = false,
            isFollower = false;
        let connectRequest = null; 
        let followRequest = null;  
        const feed = await Feeds.findOne({ where: { feed_name: feedName } });
        if (!feed) {
            return res.status(404).json({ success: false, message: 'Feed not found' }); 
        }
        //If user is logged in and is the owner
        if (userId && userId === feed.feed_owner) {
            isAdmin = true;
            isMod = true;
            isConnected = true;
            isFollower = true;
        } else if (viewerId) {
            //If viewer has a feed_id but isn't the owner
            const followStatus = await FollowerCheck(viewerId, feed.feed_id);
            isAdmin = followStatus.isAdmin;
            isMod = followStatus.isMod;
            isFollower = followStatus.following;
            if (!feed.is_group) {
                connectRequest = await ConnectRequests.findOne({ 
                    where: {
                        [Op.or]: [
                            { sender_id: viewerId, receiver_id: feed.feed_id },
                            { sender_id: feed.feed_id, receiver_id: viewerId } 
                        ]
                    }
                });
                const connectStatus = await ConnectCheck(viewerId, feed.feed_id);
                isConnected = connectStatus.connected;
            }
            if (feed.type === 'private') {
                followRequest = await FollowRequests.findOne({ 
                    where: { sender_id: viewerId, receiver_id: feed.feed_id } 
                });
            }
        }
        const feedResult = {
            ...feed.toJSON(),
            isAdmin, 
            isMod, 
            isOwner: (userId === feed.feed_owner),
            isConnected,
            isFollower,
        };
        if (!feed.is_group) {
            feedResult.connectRequest = connectRequest; 
        }
        if (feed.type === 'private') {
            feedResult.followRequest = followRequest; 
        }
        res.status(200).json({ success: true, feedResult });
    } catch (error) {
        console.error(new Date().toISOString(), '/feed error:', error);
        res.status(500).json({ success: false, message: 'Error retrieving the feed' });
    }
});

router.get('/feed_channel_messages', higherLimiter, async (req, res) => {
    try {
        const { channelId, limit, offset } = req.query;
        const messages = await FeedChannelMessages.findAll({
            where: { channel_id: channelId },
            include: [{ model: Feeds }],
            order: [['timestamp', 'ASC']],
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
        });
        res.status(200).json({ messages, success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/feed_channel_messages error:', error);
        res.status(500).json({ success: false, message: 'Error getting messages' });   
    }
});

router.post('/follow_feed', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { followerId, followedFeedId } = req.body;
        await Followers.create({
            follow_id: v4(),
            follower_id: followerId,
            feed_id: followedFeedId,
            is_mod: false,
            is_admin: false
        });
        const feed = await Feeds.findByPk(followedFeedId);
        await feed.increment('follower_count');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/follow_feed error:', error);
        res.status(500).json({ success: false, message: 'Error following feed' });
    }
});

router.get('/follow_requests/:feedId', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const requests = await FollowRequests.findAll({ 
            where: { receiver_id: feedId },
            include: [{
                model: Feeds, 
                as: 'sender',
                required: true,
            }],
        }); 
        res.status(200).json({ success: true, requests });
    } catch (error) {
        console.error(new Date().toISOString(), '/follow_requests error:', error);
        res.status(500).json({ success: false, message: 'Error getting requests' });
    }
});

router.get('/get_feed_channels/:feedId', standardLimiter, async (req, res) => {
    try {
        const feedId = req.params.feedId; 
        const saverId = req.session.viewer_id;
        if (feedId === 'saved') { //Channels in the 'saved' feed
            const channels = await SavedPostChannels.findAll({
                where: { saver_id: saverId },
                include: [{
                    model: Feeds,
                    as: 'feed',
                }],
                order: [['display_order', 'ASC'], ['channel_name', 'ASC']] 
            });
            return res.status(200).json({ success: true, channels });
        }
        const channels = await FeedChannels.findAll({
            where: { feed_id: feedId },
            include: [{
                model: Feeds,
                as: 'feed',
            }],
            order: [['display_order', 'ASC'], ['channel_name', 'ASC']] //Secondary in case of same display order
        });
        res.status(200).json({ success: true, channels });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_feed_channels error:', error);
        res.status(500).json({ success: false, message: 'Error getting channels' });
    }
});

router.get('/get_feed_followers/:feedId', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const followers = await Followers.findAll({
            where: { feed_id: feedId },
            include: [{
                model: Feeds,
                as: 'followerFeed',
                required: true,
            }],
            attributes: ['follow_id', 'follower_id', 'is_mod', 'is_admin', 'created_at'],
            order: [[{ model: Feeds, as: 'followerFeed' }, 'feed_name', 'ASC']]
        });
        res.status(200).json({ success: true, followers });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_feed_followers error:', error);
        res.status(500).json({ success: false, message: 'Error getting followers' });
    }
});

router.get('/get_saved_posts', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const saverId = req.session.viewer_id;
        const { limit = 100, offset = 0 } = req.query;
        const rows = await SavedPosts.findAll({
            where: { saver_id: saverId },
            include: [{
                model: Posts,
                include: [
                    { model: Feeds, as: 'poster' },
                    { model: FeedChannels, as: 'parentChannel', include: [{ model: Feeds }] },
                ]
            }],
            order: [['created_at', 'DESC']], 
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });
        const posts = rows.map(r => {
            const post = r.post.dataValues;
            return { ...post, is_saved: true };
        });
        res.status(200).json({ posts });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_saved_posts error:', error);
        res.status(500).json({ posts: [], message: 'Error getting posts' });
    }
});

router.post('/remove_from_deep_feed', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { deepFeedId, feedId } = req.body;
        if (!feedId) {
            return res.status(400).json({ success: false, message: 'Id missing' });
        }
        const where = {
            deep_feed_id: deepFeedId,
            feed_id: feedId
        };
        await DeepFeedContent.destroy({ where });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/remove_from_deep_feed error:', error);
        res.status(500).json({ success: false, message: 'Error removing from feed' });
    }
});

router.delete('/remove_saved_post', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { channelId, feedId, postId } = req.body;
        const count = await SavedPosts.destroy({
            where: { channel_id: channelId, post_id: postId, saver_id: feedId }
        });
        if (!count) return res.status(404).json({ success: false, message: 'Not saved' });
        res.status(200).json({ success: true });
    } catch {
        console.error(new Date().toISOString(), '/remove_saved_post error:', error);
        res.status(500).json({ success: false, message: 'Error removing saved post' });
    }
});

router.put('/reorder_feed_channels', higherLimiter, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { feed_id, orderedChannelIds } = req.body; 
        if (!feed_id || !Array.isArray(orderedChannelIds)) {
            return res.status(400).json({ success: false, message: 'Missing feed_id or orderedChannelIds.' });
        }
        const updatePromises = orderedChannelIds.map((channel_id, index) => {
            return FeedChannels.update(
                { display_order: index },
                {
                    where: {
                        channel_id: channel_id,
                        feed_id: feed_id 
                    },
                    transaction
                }
            );
        });
        await Promise.all(updatePromises);
        await transaction.commit();
        res.status(200).json({ success: true, message: 'Channels reordered successfully.' });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/reorder_feed_channels error:', error);
        res.status(500).json({ success: false, message: 'Failed to reorder channels.' });
    }
});

router.post('/save_post', higherLimiter, authenticateCheck, async (req, res) => {
	try {
		const { channelId, feedId, postId } = req.body;
        //const { channelId, feedId, postId, savedChannelId } = req.body; //Upon proper channels implementation
		const where = { channel_id: channelId, post_id: postId, saver_id: feedId };
        const mainChannel = await SavedPostChannels.findOne({
            where: { saver_id: feedId, channel_name: 'Main' }
        })
		const existing = await SavedPosts.findOne({ where });
		if (existing) {
			await existing.destroy();
			return res.status(200).json({ saved: false });
		}
		await SavedPosts.create({ ...where, feed_id: feedId, saved_channel_id: mainChannel.channel_id });
		res.status(200).json({ saved: true });
	} catch (error) {
        console.error(new Date().toISOString(), '/save_post error:', error);
		res.status(500).json({ success: false, message: 'Error saving post' });
	}
});

router.post('/send_follow_request', higherLimiter, authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { receiverId, senderId } = req.body;
        await FollowRequests.create({
            request_id: v4(),
            sender_id: senderId,
            receiver_id: receiverId,
        });
        await Feeds.increment(
            { follow_requests: 1 },
            { where: { feed_id: receiverId }, transaction }
        );
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/send_follow_request error:', error);
        res.status(500).send({ success: false, message: 'Failed to send request.' });
    }
});

router.post('/toggle_admin', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { feedId, followerId, isAdmin } = req.body;
        await Followers.update({ is_admin: isAdmin }, { where: { feed_id: feedId, follower_id: followerId } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/toggle_admin error:', error);
        res.status(500).json({ success: false, message: 'Failed to set admin.' });
    }
});

router.post('/toggle_lock', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { feedId } = req.body;
        const feed = await Feeds.findByPk(feedId);
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }
        feed.is_locked = !feed.is_locked;
        await feed.save();
        return res.status(200).json({ success: false, is_locked: feed.is_locked });
    } catch (error) {
        console.error(new Date().toISOString(), '/toggle_lock error:', error);
        return res.status(500).json({ success: false, message: 'Failed to set lock' });
    }
});

router.post('/toggle_moderator', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { feedId, followerId, isMod } = req.body;
        await Followers.update(
            { is_mod: isMod },
            { where: { feed_id: feedId, follower_id: followerId } }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/toggle_moderator error:', error);
        res.status(500).json({ success: false, message: 'Failed to set mod' });
    }
});

router.post('/toggle_private', standardLimiter, authenticateCheck, async (req, res) => {
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const { feedId } = req.body;
		const feed = await Feeds.findOne({ where: { feed_id: feedId }, transaction });
		if (!feed) {
			await transaction.rollback();
			return res.status(404).json({ success: false, message: 'Feed not found' });
		}
		const newType = feed.type === 'public' ? 'private' : 'public';
		const isPrivate = newType === 'private';
		await feed.update({ type: newType }, { transaction });
		await Posts.update({ is_private: isPrivate }, { where: { feed_id: feedId }, transaction });
		await transaction.commit();
		res.status(200).json({ success: true, type: newType });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), '/toggle_private error:', error);
		res.status(500).json({ success: false, message: 'Failed to toggle feed privacy' });
	}
});

router.post('/transfer_ownership', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { feedId, newOwnerId } = req.body;
        await Feeds.update({ feed_owner: newOwnerId }, { where: { feed_id: feedId } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/transfer_ownership error:', error);
        res.status(500).json({ success: false, message: 'Failed to transfer ownership' });
    }
});

router.put('/update_feed_photo/:feedId', standardLimiter, authenticateCheck, checkProfileStorageLimit, async (req, res) => {
    feedProfileUpload(req, res, async function (error) {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 500MB' });
            }
            return res.status(400).json({ success: false, message: 'File too large' });
        } else if (error) {
            console.error(new Date().toISOString(), 'file upload error in /update_feed_photo:', error);
            return res.status(400).json({ success: false, message: 'Upload error' });
        }
        try {
            const feed_id = req.params.feedId; 
            const file = req.file; 
            if (!file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            const fileSize = calculateFileSize(file);
            const user = req.currentUser;
            const maxStorage = user.has_membership ? 30 * 1024 : 300; //Weekly limit of 30GB for members, 300MB for non-members
            if (user.storage_count + fileSize > maxStorage) {
                if (process.env.NODE_ENV === 'production') {
                    const fileName = GenerateFileName(file, 'feed-image');
                    await DeleteFromS3(`feed-images/${fileName}`);
                } else {
                    fs.unlinkSync(file.path);
                }
                return res.status(413).json({ success: false, message: `Weekly limit of ${maxStorage}MB exceeded` });
            }
            let newPhotoPath;
                if (process.env.NODE_ENV === 'production') {
                    const fileName = GenerateFileName(file, 'feed-image');
                    const s3Key = `feed-images/${fileName}`;
                    await UploadToS3(s3Key, file.buffer, file.mimetype);
                    newPhotoPath = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
                } else {
                const fileName = GenerateFileName(file, 'feed-image');
                const localPath = path.join(mediaDir, fileName);
                if (file.path !== localPath) {
                    fs.copyFileSync(file.path, localPath);
                }
                newPhotoPath = "/" + path.join('media', 'feed_images', fileName).replace(/\\/g, "/");
            }
            const feed = await Feeds.findOne({ where: { feed_id } });
            //Delete old photo if not default
            if (feed.feed_photo && !defaultImages.includes(feed.feed_photo)) {
                if (feed.feed_photo.startsWith('http')) {
                    if (feed.feed_photo.includes(process.env.CLOUDFRONT_DOMAIN)) {
                        const url = new URL(feed.feed_photo);
                        const s3Key = url.pathname.replace(/^\/+/, '');
                        await DeleteFromS3(s3Key);
                    }
                } else {
                    const oldPath = path.join(process.cwd(), feed.feed_photo);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
            }
            user.storage_count += fileSize;
            await user.save();
            feed.feed_photo = newPhotoPath;
            await feed.save();
            return res.status(200).json({ success: true, newPhotoPath });
        } catch (error) {
            console.log(new Date().toISOString(), '/update_feed_photo error:', error);
            if (req.file) {
                try {
                    if (process.env.NODE_ENV === 'production') {
                        const fileName = GenerateFileName(req.file, 'feed-image');
                        await DeleteFromS3(`feed-images/${fileName}`);
                    } else if (req.file.path) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupErr) {
                    console.error(new Date().toISOString(), 'Failed to cleanup file:', cleanupErr);
                }
            }
            res.status(500).json({ success: false, message: 'Failed to update photo' });
        }
    });
});

router.post('/unfollow_feed', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { followerId, followedFeedId } = req.body;
        await Followers.destroy({
            where: { follower_id: followerId, feed_id: followedFeedId }
        });
        const feed = await Feeds.findByPk(followedFeedId);
        await feed.decrement('follower_count');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/unfollow_feed error:', error);
        res.status(500).json({ success: false, message: 'Failed to unfollow feed' });
    }
});

export const feedChatChannelSocket = (socket) => {
    socket.on('join_channel', (channel_id) => {
        socket.join(channel_id);
    });
    socket.on('leave_channel', (channel_id) => {
        socket.leave(channel_id);
    });
    socket.on('delete_feed_message', async (data) => {
        const { message_id, channel_id } = data;
        await FeedChannelMessages.destroy({ where: { message_id: data.message_id } });
        socket.to(channel_id).emit('delete_feed_message', { message_id });
    });
    socket.on('send_feed_message', async (message) => {
        try {
            if (message.content.length === 0) {
                socket.emit('error_message', { error: 'Message too short' });
                return;
            }
            if (message.content.length > 1000) {
                socket.emit('error_message', { error: 'Message too long' });
                return;
            }
            const newMessage = await FeedChannelMessages.create({
                message_id: message.message_id,
                content: message.content,
                channel_id: message.channel_id,
                sender_id: message.sender_id,
                timestamp: message.timestamp,
            });
            await FeedChannels.update(
                { updated_at: message.timestamp || new Date() },  
                { where: { channel_id: message.channel_id } }
            );
            socket.emit('channel_message_confirmed', newMessage);
            socket.to(message.channel_id).emit('channel_message_confirmed', newMessage);
        } catch (error) {
            console.error(new Date().toISOString(), 'Error handling feed message:', error);
        }
    });
};

export default router;