import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
import { Posts, PostVotes } from '../models/content.js'; 
import { Feeds, FeedChannels, Followers } from '../models/feeds.js'; 
import { Connections, ConnectRequests, FeedChats, Messages } from '../models/messages.js'; 
import { Users } from '../models/users.js'; 

const router = Router();

//Changes user password
router.post('/change_password', authenticateCheck, async (req, res) => {
    try {
        const { password, userId } = req.body;
        const hashedPassword = await hash(password, 10);
        const user = await Users.findOne({ where: {user_id: userId} });
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
                return res.status(401).json({ success: false });
            }
            const userData = {
                username: user.username,
                userId: user.user_id,
                hasMembership: user.has_membership,
                points: user.points
            };
            res.json({ authenticated: true, user: userData });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    } else {
        res.status(401).json({ success: false });
    }
});

//Deletes user accont and all associated data
router.delete('/delete_account', authenticateCheck, async (req, res) => {
    try {
        const { userId } = req.body;
        const feed = await Feeds.findOne({ where: { userId } });
        const id = feed.feed_id;
        deleteMedia(feed.feed_photo);
        await FeedChannels.destroy({ where: { feed_id: id } });
        await Posts.destroy({ where: { poster_id: id } });
        await Followers.destroy({ where: { follower_id: id } });
        await PostVotes.destroy({ where: { voter_id: id } });
        await Connections.destroy({ where: { [Op.or]: [{ feed1_id: id }, { feed2_id: id }] } });
        await ConnectRequests.destroy({ where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] } });
        await FeedChats.destroy({ where: { feed_id: id } });
        await Messages.destroy({ where: { sender_id: userId } });
        await Feeds.destroy({ where: { feed_owner: userId } });
        await Users.destroy({ where: { userId } });
        res.clearCookie('sid');
        return res.json({ success: true });
    } catch (error) {
        return res.json({ success: false });
    }
});

router.post('/join', async (req, res) => {
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
        const feed_id = v4();
        await Feeds.create({
            feed_id, feed_name: username, description: "", feed_photo: default_photo, type: 'private', is_group: false, feed_owner: user_id
        });
        //Sets up main channel
        const channel_id = v4();
        await FeedChannels.create({
            channel_id, channel_name: 'Main', feed_id
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy( error => {
        if (error) {
            return res.json({ success: false });
        }
        res.clearCookie('sid');
        return res.json({ success: true });
    });
});

export default router;