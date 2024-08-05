import authenticateCheck from '../functions/authenticateCheck.js';
import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
import { ContentVotes, Followers, Friends, FriendRequests, GroupReplies, GroupPosts, Messages, Profiles, ProfileChannels, ProfileReplies, ProfilePosts, ReplyVotes, Users, UserConversations, UserGroups } from '../models/models.js';

const router = Router();

//Changes user password
router.post('/change_password', authenticateCheck, async (req, res) => {
    try {
        const { password, user_id } = req.body;
        const hashedPassword = await hash(password, 10);
        const user = await Users.findOne({ where: {user_id} });
        await user.update({ password: hashedPassword });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error changing password'});
    }
});

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
                userId: user.user_id,
                hasMembership: user.has_membership
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
        const profile = await Profiles.findOne({ where: { user_id } });
        await ProfileChannels.destroy({ where: { profile_id: profile.profile_id } });
        await ProfilePosts.destroy({ where: { poster_id: user_id } });
        await ProfileReplies.destroy({ where: { replier_id: user_id } });
        await UserGroups.destroy({ where: { user_id } });
        await GroupPosts.destroy({ where: { poster_id: user_id } });
        await GroupReplies.destroy({ where: { replier_id: user_id } });
        await Followers.destroy({ where: { follower_id: user_id } });
        await ContentVotes.destroy({ where: { user_id } });
        await ReplyVotes.destroy({ where: { user_id } });
        await Friends.destroy({ where: { [Op.or]: [{ user1_id: user_id }, { user2_id: user_id }] } });
        await FriendRequests.destroy({ where: { [Op.or]: [{ sender_id: user_id }, { receiver_id: user_id }] } });
        await UserConversations.destroy({ where: { user_id } });
        await Messages.destroy({ where: { sender_id: user_id } });
        await Profiles.destroy({ where: { user_id } });
        await Users.destroy({ where: { user_id } });
        res.clearCookie('sid');
        return res.json({ success: true });
    } catch (error) {
        return res.json({ success: false, message: 'Failed to delete account'});
    }
});

router.post('/register', async (req, res) => {
    try {
        const username = req.body.username;
        //Check for existing username
        const existingUser = await Users.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        //Add user info to database, including encrypted password
        const user_id = v4();
        const hashedPassword = await hash(req.body.password, 10);
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
        //Sets up main channel
        const channel_id = v4();
        await ProfileChannels.create({
            channel_id, channel_name: 'Main', profile_id
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
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