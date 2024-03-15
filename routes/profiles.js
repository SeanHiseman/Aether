import express from 'express';
import { Router } from 'express';
import { v4 } from 'uuid';
import { fileURLToPath } from 'url';
import { join } from 'path';
import path, { extname } from 'path';
import authenticateCheck from '../functions/authenticateCheck.js';
import session from 'express-session';
import multer, { diskStorage } from 'multer';
import { Conversations, Friends, FriendRequests, Profiles, ProfileChannels, ProfilePosts, Users, UserConversations } from '../models/models.js';

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
router.put('/accept_friend_request/:requestId', authenticateCheck, async (req, res) => {
    try {
        const friendRequest = await friendRequest.findByPk(req.params.requestId);
        if (!friendRequest) {
            return res.status(404).json({ error: "Friend request not found" });
        }

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

        await UserConversations.bulkCreate([
            { user_id: friendRequest.sender_id, conversation_id: conversation.conversation_id },
            { user_id: friendRequest.receiver_id, conversation_id: conversation.conversation_id }
        ]);

        await friendRequest.destroy();
        res.json({ message: "Friend request accepted" });
    } catch (error) {
        res.status(500).send(error.message);
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
        res.status(200).send("Friend request cancelled");
    } catch (error) {
        res.status(500).send(error.message);
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
        if (!user) {
            return res.status(404).json({ "status": "error", "message": "Could not fetch user_id" });
        }

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
    } catch (e) {
        console.error(e);
        return res.status(404).json({ "status": "error", "message": e.message });
    }
});

//Get friend requests
router.get('/get_friend_requests', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await Users.findOne({ where: { user_id: userId } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const requests = await FriendRequest.findAll({ where: { receiver_id: userId } });
        const response = requests.map(req => ({
            request_id: req.request_id,
            from: req.sender_id,
            senderName: req.sender.username 
        }));

        res.json(response);
    } catch (error) {
        res.status(500).send(error.message);
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
router.get('/profile_channel_posts/:profileId/:channelId', authenticateCheck, async (req, res) => {
    try {
        const { channelId, profileId } = req.params;
        //Limits number of posts returned
        //const limit = parseInt(req.query.limit) || 10;
        //const offset = parseInt(req.query.offset) || 0;
        const posts = await ProfilePosts.findAll({
            where: {
                profile_id: profileId,
                channel_id: channelId
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
        res.status(500).send('Error fetching posts:', error);   
    }
});

//Load user profiles
router.get('/profile/:username', authenticateCheck, async (req, res) => {
    const loggedInUserId = req.session.user_id;
    try {
        let viewedUser = await Users.findOne({ where: { username: req.params.username } });
        if (!viewedUser) {
            return res.status(404).send("User not found");
        }
        //Finds profile associated with user
        let profile = await Profiles.findOne({ where: { user_id: viewedUser.user_id } });
        if (!profile) {
            return res.status(404).send("Profile not found")
        }

        //let friendship, friendRequest = null;
        //try {
            //[friendship, friendRequest] = await Promise.all([
                //Friends.findOne({
                    //where: {
                        //[Op.or]: [
                            //{ user1_id: loggedInUserId, user2_id: viewedUser.user_id },
                            //{ user1_id: viewedUser.user_id, user2_id: loggedInUserId}
                        //]
                    //}
                //}),
                //FriendRequests.findOne({
                    //where: {
                        //[Op.or]: [
                            //{ sender_id: loggedInUserId, receiver_id: viewedUser.user_id },
                            //{ sender_id: viewedUser.user_id, receiver_id: loggedInUserId}
                        //]
                    //}
                //})
            //]);
        //} catch (friendshipError) {
            //console.error("Error", error);
            //return res.status(500).send("Error fetching friendship data." + friendshipError);
        //}
        //let user_content = await Posts.findAll({
            //where: { poster_id: profile.user_id },
            //order: [['timestamp', 'DESC']]
        //});

        //Provides each item posted by the user with profile info
        //user_content.forEach(item => {
            //item.username = user.username;
            //item.profile_photo = profile.profile_photo;
            //item.profile_id =profile.profile_id;
        //});

        const responseData = {
            profile: {
                profileId: profile.profile_id,
                profilePhoto: profile.profile_photo,
                username: viewedUser.username,
                bio: profile.bio,
                userId: viewedUser.user_id, 
                //isFriend: !!friendship,
                //isRequested: !!friendRequest
            },
            //user_content: user_content
        }
        res.json(responseData);

    } catch (error) {
        res.status(500).send(`Internal Server Error: ${error.toString()}`);
    }
});

//Reject friend request
router.delete('/reject_friend_request/:requestId', authenticateCheck, async (req, res) => {
    try {
        const friendRequest = await friendRequest.findByPk(req.params.requestId);
        if (!friendRequest) {
            return res.status(404).json({ error: "Friend request not found" });
        }

        await friendRequest.destroy();
        res.json({ message: "Friend request rejected" });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Send friend request
router.post('/send_friend_request', authenticateCheck, async (req, res) => {
    const { receiverProfileId } = req.body;
    try {
        const receiverProfile = await Profiles.findOne({ where: { profile_id: receiverProfileId } });
        if (!receiverProfile) {
            return res.status(404).json({ message: "Receiver profile not found" });
        }

        const userId = req.session.user_id;
        const user = await Users.findOne({ where: { user_id: userId } });
        if (!user) {
            return res.status(404).json({ message: "Sender user not found" });
        }

        const existingRequest = await FriendRequests.findOne({
            where: {
                sender_id: user.user_id,
                receiver_id: receiverProfile.user_id
            }
        });

        if (existingRequest) {
            return res.json({ message: "Friend request already sent" });
        }

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



