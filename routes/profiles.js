import express from 'express';
import { Router } from 'express';
import { v4 } from 'uuid';
import { fileURLToPath } from 'url';
import { join } from 'path';
import path from 'path';
import authenticateCheck from '../functions/authenticateCheck.js';
import session from 'express-session';
import multer, { diskStorage } from 'multer';
import { Conversations, Profiles, ProfileChannels, Users, UserConversations } from '../models/models.js';

const app = express();
const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'static')));
app.use(session({ secret: 'EDIT_ME', resave: true, saveUninitialized: true }));

//Load users own profile
router.get('/personal-profile/:username', authenticateCheck, async (req, res) => {
    try {
        let user = await Users.findOne({ where: { username: req.params.username } });
        if (!user) {
            return res.status(404).send("User not found");
        }
        //Finds profile associated with user
        let profile = await Profiles.findOne({ where: { user_id: user.user_id } });
        if (!profile) {
            return res.status(404).send("Profile not found")
        }
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
                logged_in_profile_id: profile.profile_id,
                logged_in_profile_photo: profile.profile_photo,
                logged_in_username: user.username,
                bio: profile.bio
            },
            //user_content: user_content
        }
        res.json(responseData);

    } catch (error) {
        res.status(500).send(`Internal Server Error: ${error.toString()}`);
    }
});

//Create new channel within a profile
router.post('/add_profile_channel', authenticateCheck, async (req, res) => {
    try {
        const { profileId } = req.params.profileId;
        const { channel_name } = req.body.channel_name;

        //Checks if group can be found
        const group = await Profiles.findByPk(profileId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found'});
        }

        const newChannel = await ProfileChannels.create({ channel_name, profile_id: profileId});
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Send friend request
router.post('/send_friend_request/:receiverProfileId', authenticateCheck, async (req, res) => {
    try {
        const receiverProfile = await Profiles.findOne({ where: { profile_id: req.params.receiverProfileId } });
        if (!receiverProfile) {
            return res.status(404).json({ message: "Receiver profile not found" });
        }

        const userId = req.session.user_id;
        const user = await Users.findOne({ where: { user_id: userId } });
        if (!user) {
            return res.status(404).json({ message: "Sender user not found" });
        }

        const existingRequest = await FriendRequest.findOne({
            where: {
                sender_id: user.user_id,
                receiver_id: receiverProfile.user_id
            }
        });

        if (existingRequest) {
            return res.json({ message: "Friend request already sent" });
        }

        await FriendRequest.create({
            request_id: uuidv4(),
            sender_id: user.user_id,
            receiver_id: receiverProfile.user_id
        });

        res.json({ message: "Friend request sent" });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Accept friend request
router.put('/accept_friend_request/:requestId', authenticateCheck, async (req, res) => {
    try {
        const friendRequest = await FriendRequest.findByPk(req.params.requestId);
        if (!friendRequest) {
            return res.status(404).json({ error: "Friend request not found" });
        }

        await Friend.create({
            friendship_id: uuidv4(),
            user1_id: friendRequest.sender_id,
            user2_id: friendRequest.receiver_id,
            FriendSince: new Date()
        });

        const conversation = await Conversations.create({ conversation_id: uuidv4() });

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

//Reject friend request
router.delete('/reject_friend_request/:requestId', authenticateCheck, async (req, res) => {
    try {
        const friendRequest = await FriendRequest.findByPk(req.params.requestId);
        if (!friendRequest) {
            return res.status(404).json({ error: "Friend request not found" });
        }

        await friendRequest.destroy();
        res.json({ message: "Friend request rejected" });
    } catch (error) {
        res.status(500).send(error.message);
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

//Multer setup for file uploads
const profile_photo_storage = diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'frontend/public/media/images/profile_images');
    },
    filename: function (req, file, cb) {
        cb(null, v4() + extname(file.originalname));
    }
});
//Check file input
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'iage/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}
//Uploads with file size limit
const upload = multer({
    storage: profile_photo_storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: fileFilter
});

//Update profile photo
router.post('/update_profile_photo', authenticateCheck, async (req, res) => {

    const profileId = req.session.profile_id; 
    const file = req.files.new_profile_photo; 
    
    if (allowedFile(file.name)) {
        const filename = basename(file.name);
        file.mv(join(__dirname, 'media/images/profile_images', filename));

        const newPhotoPath = join('images/profile_images', filename).replace(/\\/g, '/');
        const profile = await Profiles.findOne({ where: { profile_id: profileId } });

        if (profile) {
            profile.profile_photo = newPhotoPath;
            await profile.save();
            return res.redirect(`/user/profile/${profileId}`);
        } else {
            res.status(404).json({ message: "Profile not found" });
        }
    } else {
        req.flash('File not allowed. Please upload an image.');
        return res.redirect(req.url);
    }
});

//Update profile bio
router.post('/update_bio', authenticateCheck, async (req, res) => {
    try {
        const bio = req.body.bio;
        const profileId = req.session.profile_id; 
        const profile = await Profiles.findOne({ where: { profile_id: profileId } });

        if (profile) {
            profile.bio = bio;
            await profile.save();
            return res.redirect(`/user/profile/${profileId}`);
        } else {
            res.status(404).json({ message: "Profile not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update bio" });
    }
});

export default router;



