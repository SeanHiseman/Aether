import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import dotenv from 'dotenv';
import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
import { Connections, ConnectRequests, Feeds, FeedChannels, Followers, FeedChats, Messages, Posts, PostVotes, Users } from '../models/relationships.js'; 
import { generateVerificationToken, sendVerificationEmail } from '../functions/emailService.js';
import sequelize from '../databaseSetup.js';

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
            return res.status(200).json({
                authenticated: false,
                feeds: null,
                user: null,
                currentFeed: null
            });
        }
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(200).json({
                authenticated: false,
                feeds: null,
                user: null,
                currentFeed: null
            });
        }
        const feeds = await Feeds.findAll({ 
            where: { 
                is_group: 0, 
                feed_owner: req.session.user_id 
            }
        });
        if (!req.session.feed_id && feeds.length > 0) {
            req.session.feed_id = feeds[0].feed_id;
        }
        return res.status(200).json({
            authenticated: true,
            feeds: feeds || [],
            user,
            currentFeed: req.session.feed_id
        });
    } catch (error) {
        return res.status(200).json({
            authenticated: false,
            feeds: null,
            user: null,
            currentFeed: null
        });
    }
});

//Deletes user accont and all associated data
router.delete('/delete_account', authenticateCheck, async (req, res) => {
    let transaction
    try {
        transaction = await sequelize.transaction();
        const { userId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_owner: userId } });
        const id = feed.feed_id;
        if (feed.feed_photo !== process.env.DEFAULT_USER_IMAGE) {
            deleteMedia(feed.feed_photo)
        }
        await FeedChannels.destroy({ where: { feed_id: id }, transaction });
        await Posts.destroy({ where: { poster_id: id }, transaction });
        await Followers.destroy({ where: { follower_id: id }, transaction });
        await PostVotes.destroy({ where: { voter_id: id }, transaction });
        await Connections.destroy({ where: { [Op.or]: [{ feed1_id: id }, { feed2_id: id }] }, transaction });
        await ConnectRequests.destroy({ where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] }, transaction });
        await FeedChats.destroy({ where: { feed_id: id }, transaction });
        await Messages.destroy({ where: { sender_id: userId }, transaction });
        await Feeds.destroy({ where: { feed_owner: userId }, transaction });
        await Users.destroy({ where: { user_id: userId }, transaction });
        await transaction.commit();
        res.clearCookie('sid');
        return res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        return res.status(500).json({ success: false });
    }
});

router.post('/join', async (req, res) => {
    try {
		await new Promise((resolve, reject) => {
			req.session.regenerate(err => {
				if (err) reject(err);
				else resolve();
			});
		});
        const email = req.body.email;
        const username = req.body.username;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; //Checked in frontend too
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        const existingEmail = await Users.findOne({ where: { email } });
        if (existingEmail) {
            return res.status(409).json({ message: 'Email already registered' });
        }
        const existingUser = await Users.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already taken' });
        }
        const user_id = v4();
        const hashedPassword = await hash(req.body.password, 10);
        const UserSince = new Date();
        const verificationToken = generateVerificationToken(user_id, email);
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); //24 hours
        await Users.create({
            email, user_id, username, password: hashedPassword, UserSince, email_verified: false, verification_token: verificationToken, verification_token_expires: verificationTokenExpires
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
            channel_id, channel_name: 'Main', feed_id, is_chat: false
        });
        //Add to the Development, Feedback, Welcome feeds
        await Followers.create({
            follow_id: v4(), follower_id: feed_id, feed_id: process.env.DEVELOPMENT_FEED_ID
        });
        await Followers.create({
            follow_id: v4(), follower_id: feed_id, feed_id: process.env.FEEDBACK_FEED_ID
        });
        await Followers.create({
            follow_id: v4(), follower_id: feed_id, feed_id: process.env.WELCOME_FEED_ID
        });
        await Feeds.increment('follower_count', { where: { feed_id: process.env.DEVELOPMENT_FEED_ID } });
        await Feeds.increment('follower_count', { where: { feed_id: process.env.FEEDBACK_FEED_ID } });
        await Feeds.increment('follower_count', { where: { feed_id: process.env.WELCOME_FEED_ID } });
        try {
            await sendVerificationEmail(email, username, verificationToken);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
        }
        req.session.user_id = user_id;
        req.session.username = username;
        req.session.viewer_id = feed_id;
        res.status(200).json({ success: true, message: 'Account created successfully. Please check your email to verify your account.' });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ success: false });
    }
});

router.post('/login', async (req, res) => {
    try {
		await new Promise((resolve, reject) => {
			req.session.regenerate(err => {
				if (err) reject(err);
				else resolve();
			});
		});
        const { password, username } = req.body;
        const user = await Users.findOne({ where: { [Op.or]: [{ email: username }, { username }] } });
        const feed = await Feeds.findOne({ where: { feed_owner: user.user_id, is_group: false }})
        if (user && await compare(password, user.password)) {
            req.session.user_id = user.user_id;
            req.session.username = user.username;
            req.session.email = user.email;
            req.session.has_membership = user.has_membership;
            req.theme = user.theme;
            req.usage_count = user.usage_count;
            req.storage_count = user.storage_count;
            req.session.viewer_id = feed.feed_id;
            res.status(200).json({ success: true });
        }
        else {
            res.status(401).json({ success: false });
        }
    }
    catch (error) {
        console.error('Login error:', error);
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

router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await Users.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.email_verified) {
            return res.status(400).json({ message: 'Email already verified' });
        }
        const verificationToken = generateVerificationToken(user.user_id, email);
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.update({
            verification_token: verificationToken,
            verification_token_expires: verificationTokenExpires
        });
        await sendVerificationEmail(email, user.username, verificationToken);
        res.status(200).json({ success: true, message: 'Verification email sent!' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }
        const user = await Users.findOne({ 
            where: { 
                user_id: decoded.userId,
                email: decoded.email,
                verification_token: token
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found or token invalid' });
        }
        if (user.email_verified) {
            return res.status(200).json({ message: 'Email already verified' });
        }
        if (new Date() > user.verification_token_expires) {
            return res.status(400).json({ message: 'Verification token has expired' });
        }
        await user.update({
            email_verified: true,
            verification_token: null,
            verification_token_expires: null
        });
        res.status(200).json({ success: true, message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;