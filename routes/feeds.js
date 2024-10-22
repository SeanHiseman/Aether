import authenticateCheck from '../functions/checks/authenticateCheck.js';
import checkIfAdminOrMod from '../functions/checks/adminModCheck.js'
import checkIfFollowing from '../functions/checks/followerCheck.js'
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import imageUpload from '../functions/media_handling/imageUpload.js';
import express from 'express';
import multer from 'multer';
import { join } from 'path';
import path from 'path';
import { Router } from 'express';
import { v4 } from 'uuid';
import { Feeds, FeedChannels, FeedChannelMessages, Followers, FollowRequests, NestedFeeds, Posts } from '../models/relationships.js';

const app = express();
const router = Router();
const __dirname = path.dirname(import.meta.url);
app.use(express.static(join(__dirname, 'static')));
const feedProfileUpload = imageUpload('/media/feed_profiles', 'new_feed_photo');

const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'date_created', 'type', 'is_group', 'feed_owner'];

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

router.post('/accept_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        const follow_request = await FollowRequests.findByPk(request.request_id);
        await Followers.create({
            follower_id: follow_request.sender_id,
            feed_id: follow_request.feed_id
        });
        await Feeds.increment('member_count', { where: { feed_id: follow_request.feed_id } });
        await follow-request.destroy();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
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
        const { feedName, feedId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        feed.feed_name = feedName;
        await feed.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/create_feed', authenticateCheck, async (req, res) => {
    feedProfileUpload(req, res, async function (error) {
        if (error instanceof multer.MulterError) {
            //A Multer error occurred when uploading
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 5MB' });
            }
            return res.status(500).json({ success: false });
        } else if (error) {
            return res.status(500).json({ success: false });
        }
        try {
            const { feedName, isPrivate, creatorId } = req.body;
            //Prevents duplicate group names
            const existingFeed = await Feeds.findOne({ where: { feed_name: feedName } });
            if (existingFeed) {
                return res.status(400).json({ error: 'Name taken' });//Note: image will still be uploaded - NEEDS FIXING
            }
            let feed_photo = "media/site_images/blank-group-icon.jpg";
            if (req.file) {
                feed_photo = `media/feed_images/${req.file.filename}`;
            }
            const newFeed = await Feeds.create({
                feed_id: v4(),
                feed_name: feedName,
                feed_photo,
                member_count: 1,
                is_private: isPrivate,
                feed_owner: creatorId
            });
            await FeedChannels.create({
                channel_id: v4(),
                channel_name: 'Main',
                feed_id: newFeed.feed_id,
            });
            await Followers.create({
                follow_id: v4(),
                follower_id: creatorId,
                feed_id: newFeed.feed_id,
                is_mod: true,
                is_admin: true,
            });
            res.status(201).json({ success: true, newFeed });
        } catch (error) {
           res.status(500).json({ success: false });
        }
    });
});

router.delete('/delete_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        await FollowRequests.destroy({
            where: { sender_id: senderId, receiver_id: receiverId } 
        });
        res.status(200).json({ success: false });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Checks input for post uploads
const postFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

//Multer setup for post uploads
const post_storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'media/content');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

//Uploads with file size limit
const post_upload = multer({
    storage: post_storage,
    limits: {
        fileSize: 1024 * 1024 * 100 // 100 MB limit
    },
    fileFilter: postFilter
});

router.delete('/delete_feed', authenticateCheck, async (req, res) => {
    try {
        const { feedId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        const feedPhoto = feed.feed_photo;
        deleteMedia(feedPhoto);
        await Posts.destroy({ where: { feed_id: feedId  } });
        await FollowRequests.destroy({  where: { feed_id: feedId  } });
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
        const { channelName, feedId } = req.body;
        //Main channels are default, so can't be deleted
        if (channelName === 'Main') {
            res.status(500).json({ message: 'Main channels cannot be deleted' });
        } else {
            await FeedChannels.destroy({
                where: { 
                    channel_name: channelName,
                    feed_id: feedId
                },
            });
            res.status(200).json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/feed/:feedName', authenticateCheck, async (req, res) => {
    //try {
        const feedName = req.params.feedName;
        const viewerId = req.session.user_id;
        //const [feed, isAdminMod, isFollower, hasFollowRequest] = await Promise.all([
        const [feed] = await Promise.all([
            Feeds.findOne({ where: { feed_name: feedName } }),
            //checkIfAdminOrMod(viewerId, feedName),
            //checkIfFollowing(viewerId, feedName),
            //FollowRequests.findOne({ where: { sender_id: viewerId } })
        ]);
        if (!feed) {
            return res.status(404).json({ success: false }); 
        }
        //const { isAdmin, isMod } = isAdminMod
        const feedResult = {
            ...feed.toJSON(),
            //isAdmin, 
            //isMod, 
            isOwner: (viewerId === feed.feed_owner),
            //isFollower,
            //isRequestSent: feed.is_private ? !!hasFollowRequest : false,
        };
        res.status(200).json({ success: false, feedResult });
    //} catch (error) {
        //console.error(error);
        //res.status(500).json({ success: false });
    //}
});

router.get('/feed_channel_messages/:channelId', authenticateCheck, async (req, res) => {
    try {
        const { channelId } = req.params;
        const messages = await FeedChannelMessages.findAll({
            where: { channelId },
            include: [{
                model: Feeds,
                attributes: feedAttributes,
            }],
            order: [['timestamp', 'ASC']]
        });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false });   
    }
});

router.get('/feed_list/:followerId', async (req, res) => {
    try {
        const { followerId } = req.params.followerId;
        const feeds = await Followers.findAll({
            where: { follower_id: followerId },
            include: [{
                model: Feeds,
                where: { },
                attributes: feedAttributes,
            }],
            order: [['feed_name', 'ASC']],
        });
        const formattedFeeds = feeds.map(feed => ({
            ...feed.dataValues,
            type: feed.is_group ? 'g' : 'u',
        }));
        const feedList = formattedFeeds.sort((a, b) => a.feed_name.localeCompare(b.feed_name));
        res.json(feedList);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/follow_feed', authenticateCheck, async (req, res) => {
    try{
        const { followerId, feedId } = req.body;
        await Followers.create({
            follow_id: v4(),
            follower_id: followerId,
            feed_id: feedId,
            is_mod: false,
            is_admin: false
        });
        const feed = await Feeds.findByPk(feedId);
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
            where: { feed_id: feedId },
            include: [{
                model: Feeds, 
                as: 'sender',
                required: true,
                attributes: feedAttributes,
            }],
        }); 
        res.json({ success: true, requests });
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
            order: [['date_created', 'ASC']]
        });
        res.json({ success: true, channels });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false });
    }
});

router.get('/get_feed_followers', authenticateCheck, async (req, res) => {
    const { feedId } = req.query;
    try {
        const followers = await Followers.findAll({
            where: { feed_id: feedId },
            include: [{
                model: Feeds,
                required: true,
                attributes: feedAttributes,
            }],
            attributes: ['is_mod', 'is_admin']
        });
        res.json({ success: true, followers });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/send_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverId, senderId } = req.body;
        await FollowRequests.create({
            request_id: v4(),
            sender_id: senderId,
            group_id: receiverId,
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).send({ success: false });
    }
});

router.get('/sub_feeds/:feedId', authenticateCheck, async (req, res) => {
    try {
        const { feedId } = req.params.feedId;
        const subFeeds = await NestedFeeds.findAll({ 
            where: { parent_group_id: feedId }, 
            include: [{
                model: Feeds,
                as: 'subFeed',
                attributes: feedAttributes
            }],
            //Returns feeds alphabetically
            order: [[{ model: Groups, as: 'SubFeed' }, 'group_name', 'ASC']]
        });
        //Format for frontend
        const formattedSubFeeds = subFeeds.map(subFeed => ({
            feed_id: subFeed.sub_feed_id,  
            name: subFeed.SubFeed.feed_name,  
            photo: subFeed.SubFeed.feed_photo,
            type: 'g',                          
        }));
        res.json(formattedSubFeeds);
    } catch (error) {
        res.status(500).json({ success: false });  
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
        res.status(200).json({ success: true, updatedFeed: { ...feed, type: newType} });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.put('/update_feed_photo/:feedId', authenticateCheck, async (req, res) => {
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
            const defaultFeedPhotoPath = 'media/site_images/blank-group-icon.jpg';
            const feed_id = req.params.feedId; 
            const file = req.file; 
            const newPhotoPath = `media/feed_profiles/${file.filename}`;
            const feed = await Feeds.findOne({ where: { feed_id } });
            if (feed.feed_photo && feed.feed_photo !== defaultFeedPhotoPath) {
                deleteMedia(feed.feed_photo);
            };
            feed.feed_photo = newPhotoPath;
            await feed.save();
            return res.json({ newPhotoPath: newPhotoPath });
        } catch (error) {
            res.status(500).json({ success: false });
        };
    });
});

router.post('/unfollow_feed', authenticateCheck, async (req, res) => {
    try {
        const { followerId, feedId } = req.body;
        await Followers.destroy({
            where: { follower_id: followerId, feed_id: feedId }
        });
        const feed = await Feeds.findByPk(feedId);
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
        res.json({ success: true, currentFeed: req.session.feed_id });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

export const feedChatChannelSocket = (socket) => {
    try {
        socket.on('join_channel', (channelId) => {
            socket.join(channelId);
        });
        socket.on('delete_message', async (data) => {
            const { message_id, channel_id } = data;
            await FeedMessages.destroy({ where: { message_id } });
            socket.to(channel_id).emit('delete_message', { message_id });
        });
        socket.on('send_feed_message', async (message) => {
            const messageLength = message.message_content.length;
            if (messageLength === 0) {
                socket.emit('error_message', { error: "Message too short" });
                return;
            } else if (messageLength > 1000) {
                socket.emit('error_message', { error: "Message too long" });
                return;
            }
            const newMessage = await FeedMessages.create({
                message_id: message.message_id,
                feed_id: message.feedId,
                channel_id: message.channelId,
                message_content: message.messageContent,
                sender_id: message.senderId,
                timestamp: message.timestamp,
            });
            socket.to(message.channelId).emit('new_message', newMessage);
        });
        socket.on('leave_channel', (channelId) => {
            socket.leave(channelId);
        }) 
    } catch (error) {
        console.log("Socket error:", error);
    }
};

export default router;