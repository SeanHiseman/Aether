import authenticateCheck from '../functions/checks/authenticateCheck.js';
import ConnectCheck from '../functions/checks/connectCheck.js';
import FollowerCheck from '../functions/checks/followerCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import dotenv from 'dotenv';
import imageUpload from '../functions/media_handling/imageUpload.js';
import express from 'express';
import multer from 'multer';
import { Op } from 'sequelize';
import { join } from 'path';
import path from 'path';
import { Router } from 'express';
import { v4 } from 'uuid';
import { ConnectRequests, DeepFeeds, DeepFeedContent, Feeds, FeedChannels, FeedChannelMessages, Followers, FollowRequests, Posts, Users } from '../models/relationships.js';

const app = express();
dotenv.config();
const router = Router();
const __dirname = path.dirname(import.meta.url);
app.use(express.static(join(__dirname, 'static')));
const feedProfileUpload = imageUpload('/media/feed_images', 'new_feed_photo');

const defaultImages = [process.env.DEFAULT_USER_IMAGE, process.env.DEFAULT_GROUP_IMAGE];
const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'created_at', 'updated_at', 'type', 'is_group', 'feed_owner', 'is_locked'];

const calculateFileSize = (file) => {
    return file.size / (1024 * 1024);
};

const checkProfileStorageLimit = async (req, res, next) => {
    try {
        const user = await Users.findByPk(req.session.user.user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const maxStorage = user.has_membership ? 100 * 1024 : 100; //100GB for members, 100MB for non-members
        if (user.storage_count >= maxStorage) {
            return res.status(413).json({ 
                success: false, 
                message: `Weekly limit of ${maxStorage}MB exceeded` 
            });
        }
        req.currentUser = user;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

router.post('/accept_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        const follow_request = await FollowRequests.findByPk(request.request_id);
        await Followers.create({
            follow_id: v4(),
            follower_id: follow_request.sender_id,
            feed_id: follow_request.receiver_id
        });
        await Feeds.increment('follower_count', { where: { feed_id: follow_request.receiver_id } });
        await follow_request.destroy();
        res.status(200).json({ success: true });
    } catch (error) {

        res.status(500).json({ success: false });
    }
});

router.post('/add_feed_channel', authenticateCheck, async (req, res) => {
    try {
        let { channelName, feedId, isPosts, isChat } = req.body;
        //If channel types are not specified
        if (isPosts === false && isChat === false) {
            isPosts = true;
            isChat = true;
        };
        const newChannel = await FeedChannels.create({ 
            channel_id: v4(),
            channel_name: channelName,
            feed_id: feedId,
            is_posts: isPosts,
            is_chat: isChat
        });
        res.status(201).json({ success: true, newChannel });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/add_to_deep_feed', async (req, res) => {
    try {
        const { deepFeedId, feedId, nestedDeepFeedId } = req.body;
        console.log("add_to_deep_feed", req.body);
        if (!feedId && !nestedDeepFeedId) {
            return res.status(400).json({ success: false, message: 'Must provide either a feedId or nestedDeepFeedId' });
        }
        const content = await DeepFeedContent.create({
            content_id: v4(),
            deep_feed_id: deepFeedId,
            feed_id: feedId || null,
            nested_deep_feed_id: nestedDeepFeedId || null
        });
        res.status(201).json({ success: true, content });
    } catch (error) {
        console.log("add_to_deep_feed error", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/change_channel_name', authenticateCheck, async (req, res) => {
    try {
        const { channelId, newChannelName } = req.body;
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
        res.status(500).json({ success: false });
    }
});

router.post('/change_description', authenticateCheck, async (req, res) => {
    try {
        const { description, feedId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        feed.description = description;
        await feed.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/change_feed_name', authenticateCheck, async (req, res) => {
    try {
        const { feed_id, newName } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id } });
        feed.feed_name = newName;
        await feed.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/create_feed', authenticateCheck, checkProfileStorageLimit, async (req, res) => {
    feedProfileUpload(req, res, async function (error) {
        if (error instanceof multer.MulterError) {
            //A Multer error occurred when uploading
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 100MB' });
            }
            return res.status(500).json({ success: false });
        } else if (error) {
            return res.status(500).json({ success: false });
        }
        try {
            const { feedName, type, isGroup, feedOwner, viewerFeedId } = req.body;
            //Prevents duplicate group names
            const existingFeed = await Feeds.findOne({ where: { feed_name: feedName } });
            if (existingFeed) {
                if (req.file) {
                    fs.unlinkSync(path.join(process.cwd(), '/media/feed_images', req.file.filename));
                }
                return res.status(400).json({ error: 'Name taken' });
            }
            let feed_photo = "media/site_images/blank-group-icon.jpg";
            if (req.file) {
                feed_photo = `media/feed_images/${req.file.filename}`;
                const fileSize = calculateFileSize(req.file);
                const user = req.currentUser;
                const maxStorage = user.has_membership ? 100 * 1024 : 100;
                if (user.storage_count + fileSize > maxStorage) {
                    fs.unlinkSync(path.join(process.cwd(), '/media/feed_images', req.file.filename));
                    return res.status(413).json({ 
                        success: false, 
                        message: `Weekly limit of ${maxStorage}MB exceeded` 
                    });
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
            if (req.file) {
                try {
                    fs.unlinkSync(path.join(process.cwd(), '/media/feed_images', req.file.filename));
                } catch (err) {
                    console.error('Error deleting file:', err);
                }
            }
            res.status(500).json({ success: false });
        }
    });
});

router.post('/create_deep_feed', async (req, res) => {
    try {
        const { viewerId, deepFeedName, feedsToInclude } = req.body;
        if (!feedsToInclude || feedsToInclude.length < 2) {
            return res.status(400).json({ success: false, message: 'At least two feeds are required' });
        }
        const deepFeed = await DeepFeeds.create({
            deep_feed_id: v4(),
            owner_id: viewerId,
            name: deepFeedName,
            parent_id: null
        });
        const contents = feedsToInclude.map(feedId => ({
            content_id: v4(),
            deep_feed_id: deepFeed.deep_feed_id,
            feed_id: feedId
        }));
        await DeepFeedContent.bulkCreate(contents);
        res.status(201).json({ success: true, deepFeed, feedsToInclude });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/deep_feeds/:viewerId', async (req, res) => {
    try {
        const { viewerId } = req.params;
        console.log("deep_feeds", req.params);
        const deepFeeds = await DeepFeeds.findAll({
            where: { owner_id: viewerId, parent_id: null }
        });
        res.status(200).json({ success: true, deepFeeds });
    } catch (error) {
        console.log("deep_feeds error", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/deep_feed_contents/:deepFeedId', async (req, res) => {
    try {
        const { deepFeedId } = req.params;
        console.log("deep_feed_contents", req.params);
        const contents = await DeepFeedContent.findAll({
            where: { deep_feed_id: deepFeedId }
        });
        res.status(200).json({ success: true, contents });
    } catch (error) {
        console.log("deep_feed_contents error", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/delete_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverId, senderId } = req.body;
        await FollowRequests.destroy({
            where: { receiver_id: receiverId, sender_id: senderId } 
        });
        res.status(200).json({ success: false });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_feed', authenticateCheck, async (req, res) => {
    try {
        const { feedId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        if (!feed) {
            return res.status(404).json({ success: false });
        }
        const feedPhoto = feed.feed_photo;
        if (feedPhoto && !defaultImages.includes(feedPhoto)) {
            deleteMedia(feedPhoto);
        }
        await Posts.destroy({ where: { feed_id: feedId  } });
        await FollowRequests.destroy({
            where: {
                [Op.or]: [
                    { receiver_id: feedId },
                    { sender_id: feedId }
                ]
            }
        });
        await Followers.destroy({ where: { feed_id: feedId  } });
        await FeedChannels.destroy({ where: { feed_id: feedId  } });
        await Feeds.destroy({ where: { feed_id: feedId  } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_feed_channel', authenticateCheck, async (req, res) => {
    try {
        const { channelId } = req.body;
        await FeedChannels.destroy({
            where: { 
                channel_id: channelId,
            },
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/feed/:feedName', authenticateCheck, async (req, res) => {
    try {
        const feedName = req.params.feedName;
        const userId = req.session.user_id;
        const viewerId = req.session.feed_id;
        let isAdmin = false,
            isMod = false,
            isConnected = false,
            isFollower = false;
        let connectRequest = null; 
        let followRequest = null;  
        const feed = await Feeds.findOne({ where: { feed_name: feedName } });
        if (!feed) {
            return res.status(404).json({ success: false, message: "Feed not found." }); 
        }
        if (userId === feed.feed_owner) {
            isAdmin = true;
            isMod = true;
            isConnected = true;
            isFollower = true;
        } else {
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
        res.status(500).json({ success: false });
    }
});

router.get('/feed_channel_messages', authenticateCheck, async (req, res) => {
    try {
        const { channelId, limit, offset } = req.query;
        const messages = await FeedChannelMessages.findAll({
            where: { channel_id: channelId },
            include: [{ attributes: feedAttributes, model: Feeds }],
            order: [['timestamp', 'ASC']],
            limit: parseInt(limit) || 20,
            offset: parseInt(offset) || 0,
        });
        res.status(200).json({ messages, success: true });
    } catch (error) {
        res.status(500).json({ success: false });   
    }
});

router.get('/feed_list', async (req, res) => {
    try {
        const { followerId, offset } = req.query;
        const parsedOffset = parseInt(offset) || 0;
        const feeds = await Followers.findAll({
            where: { follower_id: followerId },
            include: [{
                model: Feeds,
                as: 'followedFeed',
                attributes: feedAttributes,
            }],
            order: [['followedFeed', 'feed_name', 'ASC']],
            limit: 30,
            offset: parsedOffset
        });;
        const formattedFeeds = feeds.map(feed => ({
            ...feed.dataValues,
            link_type: feed.followedFeed.is_group ? 'g' : 'u', 
        }));
        res.status(200).json({ success: true, formattedFeeds });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/follow_feed', authenticateCheck, async (req, res) => {
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
        res.status(500).json({ success: false });
    }
});

router.get('/follow_requests/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const requests = await FollowRequests.findAll({ 
            where: { receiver_id: feedId },
            include: [{
                model: Feeds, 
                as: 'sender',
                required: true,
                attributes: feedAttributes,
            }],
        }); 
        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_feed_channels/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId; 
        const channels = await FeedChannels.findAll({
            where: { feed_id: feedId },
            include: [{
                model: Feeds,
                as: 'feed',
                attributes: feedAttributes,
            }],
            order: [['created_at', 'ASC']]
        });
        res.status(200).json({ success: true, channels });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_feed_followers/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const followers = await Followers.findAll({
            where: { feed_id: feedId },
            include: [{
                model: Feeds,
                as: 'followerFeed',
                required: true,
                attributes: feedAttributes,
            }],
            attributes: ['follow_id', 'follower_id', 'is_mod', 'is_admin', 'created_at']
        });
        res.status(200).json({ success: true, followers });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/send_follow_request', authenticateCheck, async (req, res) => {``
    try {
        const { receiverId, senderId } = req.body;
        await FollowRequests.create({
            request_id: v4(),
            sender_id: senderId,
            receiver_id: receiverId,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).send({ success: false });
    }
});

router.post('/toggle_admin', authenticateCheck, async (req, res) => {
    try {
        const { feedId, followerId, isAdmin } = req.body;
        await Followers.update({ is_admin: isAdmin }, { where: { feed_id: feedId, follower_id: followerId } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/toggle_lock', authenticateCheck, async (req, res) => {
    try {
        const { feedId } = req.body;
        const feed = await Feeds.findByPk(feedId);
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }
        feed.is_locked = !feed.is_locked;
        await feed.save();
        return res.status(200).json({ is_locked: feed.is_locked });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/toggle_moderator', authenticateCheck, async (req, res) => {
    try {
        const { feedId, followerId, isMod } = req.body;
        await Followers.update(
            { is_mod: isMod },
            { where: { feed_id: feedId, follower_id: followerId } }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/toggle_private', authenticateCheck, async (req, res) => {
    try {
        const { feedId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        const newType = feed.type === 'public' ? 'private' : 'public';
        await feed.update({ type: newType });
        res.status(200).json({ success: true, type: newType });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/transfer_ownership', authenticateCheck, async (req, res) => {
    try {
        const { feedId, newOwnerId } = req.body;
        await Feeds.update({ feed_owner: newOwnerId }, { where: { feed_id: feedId } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.put('/update_feed_photo/:feedId', authenticateCheck, checkProfileStorageLimit, async (req, res) => {
    feedProfileUpload(req, res, async function (error) {
        if (error instanceof multer.MulterError) {
            //A Multer error occurred when uploading
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 5MB' });
            }
            return res.status(400).json({ success: false });
        } else if (error) {
            return res.status(400).json({ success: false });
        }
        try {
            const feed_id = req.params.feedId; 
            const file = req.file; 
            if (!file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            const fileSize = calculateFileSize(file);
            const user = req.currentUser;
            const maxStorage = user.has_membership ? 100 * 1024 : 100;
            if (user.storage_count + fileSize > maxStorage) {
                fs.unlinkSync(path.join(process.cwd(), '/media/feed_images', file.filename));
                return res.status(413).json({ 
                    success: false, 
                    message: `Weekly limit of ${maxStorage}MB exceeded` 
                });
            }
            const newPhotoPath = `media/feed_images/${file.filename}`;
            const feed = await Feeds.findOne({ where: { feed_id } });
            if (feed.feed_photo && !defaultImages.includes(feed.feed_photo)) {
                deleteMedia(feed.feed_photo);
            };
            user.storage_count += fileSize;
            await user.save();
            feed.feed_photo = newPhotoPath;
            await feed.save();
            return res.status(200).json({ newPhotoPath: newPhotoPath });
        } catch (error) {
            if (req.file) {
                try {
                    fs.unlinkSync(path.join(process.cwd(), '/media/feed_images', req.file.filename));
                } catch (err) {
                    console.error('Error deleting file:', err);
                }
            }
            res.status(500).json({ success: false });
        };
    });
});

router.post('/unfollow_feed', authenticateCheck, async (req, res) => {
    try {
        const { followerId, followedFeedId } = req.body;
        await Followers.destroy({
            where: { follower_id: followerId, feed_id: followedFeedId }
        });
        const feed = await Feeds.findByPk(followedFeedId);
        await feed.decrement('follower_count');
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/update_current_feed', async (req, res) => {
    try {
        const { feed_id } = req.body;
        if (!req.session || !req.session.user_id) {
            return res.status(401).json({ success: false });
        }
        const feed = await Feeds.findOne({
            where: { feed_id, feed_owner: req.session.user_id }
        });
        if (!feed) {
            return res.status(404).json({ success: false });
        }
        req.session.feed_id = feed_id;
        res.status(200).json({ success: true, currentFeed: req.session.feed_id });
    } catch (error) {
        res.status(500).json({ success: false });
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
                socket.emit('error_message', { error: "Message too short" });
                return;
            }
            if (message.content.length > 1000) {
                socket.emit('error_message', { error: "Message too long" });
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
        } catch (err) {
            console.error("Error handling feed message:", err);
        }
    });
};

export default router;