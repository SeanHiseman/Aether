import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import dotenv from 'dotenv';
import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
import { Connections, ConnectRequests, Feeds, FeedChannels, Followers, FeedChats, Messages, Posts, PostVotes, Users } from '../models/relationships.js'; 

dotenv.config();
const router = Router();

router.post('/change_password', authenticateCheck, async (req, res) => {
    try {
        const { password, user_id } = req.body;
        const hashedPassword = await hash(password, 10);
        const user = await Users.findOne({ where: {user_id} });
        await user.update({ password: hashedPassword });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Checks if user is logged in
router.get('/check_authentication', async (req, res) => {
    try {
        if (!req.session || !req.session.user_id) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(401).json({ success: false });
        }
        const feeds = await Feeds.findAll({ where: { is_group: 0, feed_owner: req.session.user_id } });
        if (!feeds || feeds.length === 0) {
            return res.status(404).json({ success: false });
        }
        if (!req.session.feed_id) {
            req.session.feed_id = feeds[0].feed_id; 
        }
        res.status(200).json({
            authenticated: true,
            feeds,
            user,
            currentFeed: req.session.feed_id
        });
    } catch (error) {
        res.status(500).json({ success: false });
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
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false });
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
        //Add initial user feed
        const default_photo = process.env.DEFAULT_USER_IMAGE;
        const feed_id = v4();
        await Feeds.create({
            feed_id, feed_name: username, description: "", feed_photo: default_photo, type: 'private', is_group: false, feed_owner: user_id
        });
        //Add main channel
        const channel_id = v4();
        await FeedChannels.create({
            channel_id, channel_name: 'Main', feed_id
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await Users.findOne({ where: { username }});
        const feed = await Feeds.findOne({ where: { feed_owner: user.user_id, is_group: false }})
        if (user && await compare(password, user.password)) {
            req.session.user_id = user.user_id;
            req.session.username = user.username;
            req.session.viewer_id = feed.feed_id;
            res.status(200).json({ success: true });
        }
        else {
            res.status(401).json({ success: false });
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