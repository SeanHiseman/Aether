import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import imageUpload from '../functions/media_handling/imageUpload.js';
import sortPostsByWeightedRatio from'../functions/postSorting.js';
import { Conversations, Followers, Friends, FriendRequests, Messages, Profiles, ProfileChannels, Users, UserConversations } from '../models/models.js';
import express from 'express';
import { join } from 'path';
import multer from 'multer';
import { Op } from 'sequelize';
import path from 'path';
import { Router } from 'express';
import session from 'express-session';
import { v4 } from 'uuid';

const app = express();
const router = Router();
const __dirname = path.dirname(import.meta.url);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'static')));
app.use(session({ secret: 'EDIT_ME', resave: true, saveUninitialized: true }));
const profileUpload = imageUpload('media/profile_images', 'new_profile_photo');

router.post('/accept_friend_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        const friendRequest = await FriendRequests.findByPk(request.request_id);
        await Friends.create({
            friendship_id: v4(),
            user1_id: friendRequest.sender_id,
            user2_id: friendRequest.receiver_id,
            FriendSince: new Date()
        });
        const conversation = await Conversations.create({ 
            conversation_id: v4(),
            title: "Main"
        });
        //Create new conversation between users
        await UserConversations.bulkCreate([
            { user_id: friendRequest.sender_id, conversation_id: conversation.conversation_id },
            { user_id: friendRequest.receiver_id, conversation_id: conversation.conversation_id }
        ]);
        await friendRequest.destroy();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Create new channel within a profile
router.post('/add_profile_channel', authenticateCheck, async (req, res) => {
    try {
        const { channel_name, isPosts, profileId } = req.body;
        //Checks if group can be found
        const profile = await Profiles.findByPk(profileId);
        const newChannel = await ProfileChannels.create({ 
            channel_id: v4(),
            channel_name, 
            profile_id: profileId,
            is_posts: isPosts
        });
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ success: false });
    }
});

router.delete('/cancel_friend_request', authenticateCheck, async (req, res) => {
    try {
        const { userId, receiverUserId } = req.body;
        await FriendRequests.destroy({
            where: { sender_id: userId, receiver_id: receiverUserId } 
        });
        res.status(200).json("Friend request cancelled");
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/change_bio', authenticateCheck, async (req, res) => {
    try {
        const { bio, profileId } = req.body;
        const profile = await Profiles.findOne({ where: { profile_id: profileId } });
        profile.bio = bio;
        await profile.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Changes user colour theme
router.post('/change_theme', authenticateCheck, async (req, res) => {
    try {
        const { theme } = req.body;
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        await Users.update(
            { theme: theme },
            { where: { user_id: userId } }
        );
        res.status(200).json({ message: 'Theme updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/change_username', authenticateCheck, async (req, res) => {
    try {
        const { username, userId } = req.body;
        const user = await Users.findOne({ where: { user_id: userId } });
        user.username = username;
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_profile_channel', authenticateCheck, async (req, res) => {
    try {
        const { channel_name, profile_id } = req.body;
        //Main channels are default, so can't be deleted
        if (channel_name === 'Main') {
            res.status(500).json({ message: 'Main channels cannot be deleted' });
        } else {
            await ProfileChannels.destroy({
                where: { 
                    channel_name,
                    profile_id
                },
            });
            res.status(200).json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});  

//User can follow another profile
router.post('/follow_profile', authenticateCheck, async (req, res) => {
    const { userId, profileId } = req.body;
    try{
        await Followers.create({
            follow_id: v4(),
            follower_id: userId,
            profile_id: profileId
        });
        //Increase group member count
        const followedProfile = await Profiles.findByPk(profileId);
        await followedProfile.increment('follower_count');
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_friend_requests', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        const requests = await FriendRequests.findAll({ 
            where: { receiver_id: userId },
            include: [{
                model: Users, 
                as: 'sender',
                required: true,
                attributes: ['user_id', 'username'],
                include: [{
                    model: Profiles,
                    as: 'profile',
                    required: false,
                    attributes: ['profile_photo', 'bio', 'follower_count', 'is_private']
                }]
            }],
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Get channels from a profile
router.get('/get_profile_channels/:profileId', authenticateCheck, async (req, res) => {
    try {
        const profileId = req.params.profileId; 
        const channels = await ProfileChannels.findAll({
            include: [{
                model: Profiles,
                where: { profile_id: profileId },
                attributes: [],
            }],
            order: [['date_created', 'ASC']]
        });
        res.json(channels);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Accesses users colour scheme
router.get('/get_theme', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.json({ theme: 'dark'});
        }
        const user = await Users.findOne({
            where: { user_id: userId },
            attributes: ['theme']
        });
        if (!user) {
            return res.json({ theme: 'dark'});
        }
        res.json({ theme: user.theme });
    } catch (error) {
        res.status(500).json({ success: false }); 
    }
});

//Rejects friend requests
router.delete('/reject_friend_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        await FriendRequests.destroy({
            where: { request_id: request.request_id }
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Removes a friend and associated chats
router.delete('/remove_friend', authenticateCheck, async (req, res) => {
    try {
        const { receiverUserId, userId } = req.body;
        await Friends.destroy({
            where: { 
                [Op.or]: [
                    { user1_id: receiverUserId, user2_id: userId },
                    { user2_id: receiverUserId, user1_id: userId },
                ]
            }
        });
        //Find all conversations involving both users
        const conversations = await Conversations.findAll({
            include: [{
                model: UserConversations,
                where: { 
                    [Op.or]: [
                        { user_id: userId },
                        { user_id: receiverUserId }
                    ]
                }
            }]
        });
        for (const conversation of conversations) {
            //Deletes all messages in the conversation
            await Messages.destroy({
                where: {
                    conversation_id: conversation.conversation_id
                }
            });
            //Removes both users from the conversation
            await UserConversations.destroy({
                where: {
                    conversation_id: conversation.conversation_id,
                    [Op.or]: [
                        { user_id: userId },
                        { user_id: receiverUserId }
                    ]
                }
            });
            //Deletes the conversation
            await Conversations.destroy({
                where: {
                    conversation_id: conversation.conversation_id
                }
            });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Load user profiles
router.get('/profile/:username', authenticateCheck, async (req, res) => {
    try {
        const loggedInUserId = req.session.user_id;
        let viewedUser = await Users.findOne({ where: { username: req.params.username } });
        //Finds profile associated with user
        let profile = await Profiles.findOne({ where: { user_id: viewedUser.user_id } });
        let follower, friendship, friendRequest = null;
        try {
            [follower, friendship, friendRequest] = await Promise.all([
                Followers.findOne({
                    where: {
                        follower_id: loggedInUserId,
                        profile_id: profile.profile_id
                    }
                }),
                Friends.findOne({
                    where: {
                        [Op.or]: [
                            { user1_id: loggedInUserId, user2_id: viewedUser.user_id },
                            { user1_id: viewedUser.user_id, user2_id: loggedInUserId}
                        ]
                    }
                }),
                FriendRequests.findOne({
                    where: {
                        [Op.or]: [
                            { sender_id: loggedInUserId, receiver_id: viewedUser.user_id },
                            { sender_id: viewedUser.user_id, receiver_id: loggedInUserId}
                        ]
                    }
                })
            ]);
        } catch (error) {
            return res.status(500).json("Error fetching friendship data.", error);
        }
        //Changes to frontend format
        const responseData = {
            profile: {
                profileId: profile.profile_id,
                profilePhoto: profile.profile_photo,
                username: viewedUser.username,
                bio: profile.bio,
                followerCount: profile.follower_count,
                isPrivate: profile.is_private,
                userId: viewedUser.user_id, 
                isFollowing: !!follower,
                isFriend: !!friendship,
                isRequested: !!friendRequest
            },
        }
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/reject_friend_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        const friendRequest = await friendRequest.findByPk(request.request_id);
        await friendRequest.destroy();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Can be used by either user to stop the following of a profile
router.post('/remove_follower', authenticateCheck, async (req, res) => {
    try {
        const { userId, profileId } = req.body;
        await Followers.destroy({
            where: { follower_id: userId, profile_id: profileId }
        });
        //Lower follower count
        const profile = await Profiles.findByPk(profileId);
        const updatedFollowerCount = await profile.decrement('follower_count', { returning: true });
        res.status(200).json({ followerCount: updatedFollowerCount });
    } catch (error) {
        res.status(500).json(error.message);
    }
}); 

router.post('/send_friend_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverUserId } = req.body;
        const receiverUser = await Users.findOne({ where: { user_id: receiverUserId } });
        const userId = req.session.user_id;
        const user = await Users.findOne({ where: { user_id: userId } });
        await FriendRequests.create({
            request_id: v4(),
            sender_id: user.user_id,
            receiver_id: receiverUser.user_id
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.put('/update_profile_photo/:profileId', authenticateCheck, (req, res) => {
    profileUpload(req, res, async function (error) {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 5MB' });
            }
            return res.status(500).json({ success: false });
        } else if (error) {
            return res.status(500).json({ success: false });
        }
        try {
            const defaultProfilePhotoPath = 'media/site_images/blank-profile.png';
            const profileId = req.params.profileId; 
            const file = req.file; 
            if (!file) {
                return res.status(400).json({ message: "Invalid file type. Please upload jpeg or png" });
            }
            const newPhotoPath = `media/profile_images/${file.filename}`; 
            const profile = await Profiles.findOne({ where: { profile_id: profileId } });
            if (profile.profile_photo && profile.profile_photo !== defaultProfilePhotoPath) {
                deleteMedia(profile.profile_photo);
            }
            profile.profile_photo = newPhotoPath;     
            await profile.save();
            return res.json({ newPhotoPath: newPhotoPath });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    });
});

export default router;



