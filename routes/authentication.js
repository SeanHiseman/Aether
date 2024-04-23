import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { v4 } from 'uuid';
import authenticateCheck from '../functions/authenticateCheck.js';
import { ContentVotes, Followers, Friends, FriendRequests, GroupReplies, GroupPosts, Messages, Profiles, ProfileChannels, ProfileReplies, ProfilePosts, ReplyVotes, Users, UserConversations, UserGroups } from '../models/models.js';

const router = Router();

//Checks if user is logged in
router.get('/check_authentication', async (req, res) => {
    if (req.session && req.session.user_id) {
        try {
            const user = await Users.findByPk(req.session.user_id);
            if (!user) {
                return res.status(401).json({ error: 'Not authenticated'});
            }
            const userData = {
                username: user.username,
                userId: user.user_id
            };
            res.json({ authenticated: true, user: userData });
        } catch (error) {
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

//Deletes user accont and all associated data
router.delete('/delete_account', authenticateCheck, async (req, res) => {
    try {
        const { user_id } = req.body;
        const userProfiles = await Profiles.findAll({ attributes: ['profile_id'], where: { user_id } });
        //In case of multiple profiles per user
        const profileIds = userProfiles.map(profile => profile.profile_id);
        await Profiles.destroy({ where: { user_id } });
        await ProfileChannels.destroy({ where: { profile_id: { [Op.in]: profileIds } } });
        await ProfilePosts.destroy({ where: { poster_id: user_id } });
        await ProfileReplies.destroy({ where: { commenter_id: user_id } });
        await UserGroups.destroy({ where: { user_id } });
        await GroupPosts.destroy({ where: { poster_id: user_id } });
        await GroupReplies.destroy({ where: { commenter_id: user_id } });
        await Followers.destroy({ where: { follower_id: user_id } });
        await ContentVotes.destroy({ where: { user_id } });
        await ReplyVotes.destroy({ where: { user_id } });
        await Friends.destroy({ where: { [Op.or]: [{ user1_id: user_id }, { user2_id: user_id }] } });
        await FriendRequests.destroy({ where: { [Op.or]: [{ sender_id: user_id }, { receiver_id: user_id }] } });
        await UserConversations.destroy({ where: { user_id } });
        await Messages.destroy({ where: { sender_id: user_id } });
        await Users.destroy({ where: { user_id } });
        res.clearCookie('sid');
        return res.json({ success: true });
    } catch(error) {
        return res.json({ success: false, message: 'Failed to delete account'});
    }
});

router.post('/register', async (req, res) => {
    try{
        const username = req.body.username;
        const password = req.body.password;

        //Check for existing username
        const existingUser = await Users.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).send('Username already taken');
        }

        //Add user info to database, including encrypted password
        const user_id = v4();
        const hashedPassword = await hash(password, 10);
        const UserSince = new Date();
        await Users.create({
            user_id, username, password: hashedPassword, UserSince
        });

        //Set up initial profile
        const default_photo = 'media/site_images/blank-profile.png';
        const profile_id = v4();
        await Profiles.create({
            profile_id, user_id, profile_photo: default_photo, bio: ""
        });

        res.json({ success: true });
    }
    catch (error) {
        //If username is already taken
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).send('Username already taken');
        } else{
            res.status(500).send('Server Error');
        }
    }
});

router.post('/login', async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;

        const user = await Users.findOne({ where: { username }});

        if (user && await compare(password, user.password)) {
            req.session.user_id = user.user_id;
            req.session.username = user.username;
            res.json({ success: true });
        }
        else {
            res.json({ success: false, message: 'Invalid username or password' });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy( error => {
        if (error) {
            return res.json({ success: false, message: 'Failed to logout'});
        }
        res.clearCookie('sid');
        return res.json({ success: true });
    });
});

export default router;