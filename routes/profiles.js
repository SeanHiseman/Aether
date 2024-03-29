import express from 'express';
import { Router } from 'express';
import { v4 } from 'uuid';
import { fileURLToPath } from 'url';
import { join } from 'path';
import path, { extname } from 'path';
import { Op } from 'sequelize';
import authenticateCheck from '../functions/authenticateCheck.js';
import session from 'express-session';
import multer, { diskStorage } from 'multer';
import { Conversations, Followers, Friends, FriendRequests, Messages, Profiles, ProfileChannels, ProfilePosts, Users, UserConversations } from '../models/models.js';

const app = express();
const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'static')));
app.use(session({ secret: 'EDIT_ME', resave: true, saveUninitialized: true }));

//Multer setup for file uploads
const profile_photo_storage = diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'media/profile_images');
    },
    filename: function (req, file, cb) {
        cb(null, v4() + extname(file.originalname));
    }
});
//Check file input
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}
//Uploads with file size limit
const upload = multer({
    storage: profile_photo_storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: fileFilter
});

//Accept friend request
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
            title: "General"
        });

        //Create new conversation between users
        await UserConversations.bulkCreate([
            { user_id: friendRequest.sender_id, conversation_id: conversation.conversation_id },
            { user_id: friendRequest.receiver_id, conversation_id: conversation.conversation_id }
        ]);

        await friendRequest.destroy();
    } catch (error) {
        res.status(500).json(error.message);
    }
});

//Create new channel within a profile
router.post('/add_profile_channel', authenticateCheck, async (req, res) => {
    try {
        const { channel_name, isPosts, profileId } = req.body;

        //Checks if group can be found
        const profile = await Profiles.findByPk(profileId);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found'});
        }

        const newChannel = await ProfileChannels.create({ 
            channel_id: v4(),
            channel_name, 
            profile_id: profileId,
            is_posts: isPosts
        });
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Cancel friend request
router.post('/cancel_friend_request', authenticateCheck, async (req, res) => {
    const { userId, receiverUserId } = req.body;
    try {
        await FriendRequests.destroy({
            where: { sender_id: userId, receiver_id: receiverUserId } 
        });
        res.status(200).json("Friend request cancelled");
    } catch (error) {
        res.status(500).json(error.message);
    }
});

//Update profile bio
router.post('/change_bio', authenticateCheck, async (req, res) => {
    try {
        const { bio, profileId } = req.body;
        const profile = await Profiles.findOne({ where: { profile_id: profileId } });
        if (profile) {
            profile.bio = bio;
            await profile.save();
            res.status(200).json({ message: "Bio updated successfully" });
        } else {
            res.status(404).json({ message: "Profile not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update bio" });
    }
});

//Update username
router.post('/change_username', authenticateCheck, async (req, res) => {
    try {
        const { username, userId } = req.body;
        const user = await Users.findOne({ where: { user_id: userId } });
        if (user) {
            user.username = username;
            await user.save();
            res.status(200).json({ message: "Name updated successfully" });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update name" });
    }
});

//Upload post to profile
router.post('/create_profile_post', authenticateCheck, upload.array('files'), async (req, res) => {
    let { profile_id, channel_id, title, content } = req.body;
    let mediaUrls = [];
    try {
        title = title || null;
        if (req.files) {
            mediaUrls = req.files.filter(file => allowedFile(file.originalname)).map(file => {
                const filepath = path.join(__dirname, 'media', file.filename);
                return filepath
            });
        }

        const post_id = v4();
        const user = await Users.findOne({ where: { username: req.session.username } });

        await ProfilePosts.create({
            post_id,
            profile_id,
            channel_id,
            title,
            content,
            media_urls: JSON.stringify(mediaUrls),
            poster_id: user.user_id,
        });
        return res.json({ "status": "success", "message": "Successful upload." });
    } catch (error) {
        return res.status(404).json({ "status": "error", "message": error.message });
    }
});

//User can follow a profile
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

        res.status(200).json();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//Get friend requests
router.get('/get_friend_requests', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        const requests = await FriendRequests.findAll({ 
            where: { receiver_id: userId },
            include: [{
                model: Users, 
                required: true,
                attributes: ['user_id', 'username']
            }],
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json(error.message);
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
            }]
        });
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//Posts made to a profile channel
router.get('/profile_channel_posts', authenticateCheck, async (req, res) => {
    try {
        const { channel_id, location_id } = req.query;
        //Limits number of posts returned
        //const limit = parseInt(req.query.limit) || 10;
        //const offset = parseInt(req.query.offset) || 0;
        const posts = await ProfilePosts.findAll({
            where: {
                profile_id: location_id,
                channel_id: channel_id
            },
            //limit: limit,
            //offset: offset,
            include: [{
                model: Users,
                as: 'ProfilePoster',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo'],
                }]
            }],
            //Posts sorted chronilogically
            order: [['timestamp', 'DESC']]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
});

//Collates content from across profile in to main feed
router.get('/profile_main_posts', authenticateCheck, async (req, res) => {
    try {
        const { location_id } = req.query;

        const posts = await ProfilePosts.findAll({
            where: {
                profile_id: location_id
            },
            include: [{
                model: Users,
                as: 'ProfilePoster',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo'],
                }]
            }],
        })
        res.json(posts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Load user profiles
router.get('/profile/:username', authenticateCheck, async (req, res) => {
    const loggedInUserId = req.session.user_id;
    try {
        let viewedUser = await Users.findOne({ where: { username: req.params.username } });
        //Finds profile associated with user
        let profile = await Profiles.findOne({ where: { user_id: viewedUser.user_id } });
        let follower, friendship, friendRequest = null;
        try {
            [follower, friendship, friendRequest] = await Promise.all([
                Followers.findOne({
                    follower_id: loggedInUserId,
                    profile_id: profile.profile_id
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

        const responseData = {
            profile: {
                profileId: profile.profile_id,
                profilePhoto: profile.profile_photo,
                username: viewedUser.username,
                bio: profile.bio,
                followerCount: profile.followerCount,
                isPrivate: profile.is_private,
                userId: viewedUser.user_id, 
                isFollowing: !!follower,
                isFriend: !!friendship,
                isRequested: !!friendRequest
            },
        }
        res.json(responseData);

    } catch (error) {
        res.status(500).json(`Internal Server Error: ${error.toString()}`);
    }
});

//Reject friend request
router.delete('/reject_friend_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        const friendRequest = await friendRequest.findByPk(request.request_id);
        await friendRequest.destroy();
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Removes follower
router.post('/remove_follower', authenticateCheck, async (req, res) => {
    const { userId, profileId } = req.body;
    try {
        await Followers.destroy({
            where: { user_id: userId, profile_id: profileId }
        });
        //Lower follower count
        const profile = await Profiles.findByPk(profileId);
        await profile.decrement('follower_count');
    } catch (error) {
        res.status(500).json(error.message);
    }
}); 

//Deletes friendship
router.delete('/remove_friend', authenticateCheck, async (req, res) => {
    try {
        const loggedInUserId = req.session.user_id;
        const { receiverUserId } = req.body;
        //Gets all conversations involving the two users
        const conversationIds = await UserConversations.findAll({
            attributes: ['conversation_id'],
            where: {
                [Op.or]: [
                    { user_id: loggedInUserId },
                    { user_id: receiverUserId}
                ]}
        }).map(entry => entry.conversation_id);

        await Conversations.destroy({
            where: {
                conversation_id: conversationIds
            }
        });
        await Friends.destroy({
            where: {
                [Op.or]: [
                    { user1_id: loggedInUserId, user2_id: receiverUserId },
                    { user1_id: receiverUserId, user2_id: loggedInUserId }
                ]}
        });
        await Messages.destroy({
            where: {
                [Op.or]: [
                    { sender_id: loggedInUserId, receiver_id: receiverUserId },
                    { sender_id: receiverUserId, receiver_id: loggedInUserId},
                ]}
        });
        await UserConversations.destroy({
            where: {
                [Op.or]: [
                    { user_id: loggedInUserId, conversation_id: conversationIds },
                    { user_id: receiverUserId, conversation_id: conversationIds }
                ]}
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove friend.' });
    }
});

//Send friend request
router.post('/send_friend_request', authenticateCheck, async (req, res) => {
    const { receiverProfileId } = req.body;
    try {
        const receiverProfile = await Profiles.findOne({ where: { profile_id: receiverProfileId } });
        const userId = req.session.user_id;
        const user = await Users.findOne({ where: { user_id: userId } });
        await FriendRequests.create({
            request_id: v4(),
            sender_id: user.user_id,
            receiver_id: receiverProfile.user_id
        });

        res.json({ message: "Friend request sent" });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Changes private status of profile
router.post('/toggle_private_profile', authenticateCheck, async (req, res) => {
    try {
        const { profile_id } = req.body;
        const profile = await Profiles.findOne({ where: { profile_id } });
        const updatedProfile = await profile.update({
            is_private: !profile.is_private,
        });
        res.status(200).json(updatedProfile);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Update profile photo
router.post('/update_profile_photo/:profileId', authenticateCheck, upload.single('new_profile_photo'), async (req, res) => {

    const profileId = req.params.profileId; 
    const file = req.file; 
    
    if (!file) {
        return res.status(400).json({ message: "Invalid file type. Please upload jpeg or png"});
    }

    const filename = file.filename;
    const newPhotoPath = `media/profile_images/${filename}`;

    try {
        const profile = await Profiles.findOne({ where: { profile_id: profileId } });
        if (profile) {
            profile.profile_photo = newPhotoPath;
            //Deletes old photo
            //if (group.group_photo) {
                //const currentPhotoPath = path.join(__dirname, '..', group.group_photo);
                //fs.unlink(currentPhotoPath, (err) => {
                    //res.status(404).json({ message: "Error deleting old photo", err });
                //});
            //}            
            await profile.save();
            return res.redirect(`/profile/${profileId}`);
        } else {
            res.status(404).json({ message: "Profile not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "An error occured while updating the profile photo"});
    }
});

export default router;



