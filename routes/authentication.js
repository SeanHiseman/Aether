import { Algorithms, AlgorithmLocations } from '../custom_algorithms/algorithmRelationships.js'
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { compare, hash } from 'bcrypt';
import { Connections, ConnectRequests, DeepFeeds, Feeds, FeedChannels, Followers, FeedChats, Messages, Posts, PostDrafts, PostNotes, PostVotes, SavedPostChannels, Users, ViewedPosts } from '../models/relationships.js'; 
import { ConnectedAccounts } from '../models/users.js';
import crypto from 'crypto';
import DeleteMedia from '../functions/media_handling/deleteMedia.js';
import dotenv from 'dotenv';
import { ExternalPostsAccess } from '../models/content.js';
import { fileURLToPath } from 'url';
import { generateVerificationToken, sendPasswordResetEmail, sendVerificationEmail } from '../functions/emailService.js';
import jwt from 'jsonwebtoken';
import { loginLimiter, resendLimiter } from '../functions/checks/limiters.js';
import { Op } from 'sequelize';
import passport from 'passport';
import path from 'path';
import { Router } from 'express';
import sequelize from '../databaseSetup.js';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { ValidateEmail } from '../functions/validateEmail.js';
import { ValidateTextInput } from '../functions/validateTextInput.js';
import { v4 } from 'uuid';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

//Google login configuration
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        //Check if user exists
        let user = await Users.findOne({ 
            where: { 
            [Op.or]: [
                { email },
                { google_id: googleId }
            ]
            } 
        });
        if (user) {
            //Update google_id if not set
            if (!user.google_id) {
            await user.update({ google_id: googleId });
            }
            return done(null, user);
        }
        //Create new user
        const transaction = await sequelize.transaction();
        try {
            const user_id = v4();
            const username = profile.displayName?.replace(/\s+/g, '_').substring(0, 30) || `user_${user_id.substring(0, 8)}`;
            //Check if username exists and make it unique
            let finalUsername = username;
            let counter = 1;
            while (await Users.findOne({ where: { username: finalUsername } })) {
                finalUsername = `${username}_${counter}`;
                counter++;
            }
            const UserSince = new Date();
            const subscriptionExpiresAt = new Date();
            subscriptionExpiresAt.setFullYear(subscriptionExpiresAt.getFullYear() + 1);
            //Create user with email already verified
            const newUser = await Users.create({
                email,
                user_id,
                username: finalUsername,
                password: await hash(crypto.randomBytes(32).toString('hex'), 10), //Random password
                UserSince,
                email_verified: true, //Auto-verify for Google OAuth
                google_id: googleId,
                has_membership: true,
                subscription_expires_at: subscriptionExpiresAt
            }, { transaction });
            //Create feed
            const googlePhoto = profile.photos?.[0]?.value;
            const feed_photo = googlePhoto || process.env.DEFAULT_USER_IMAGE;
            const feed_id = v4();
            await Feeds.create({
                feed_id,
                feed_name: finalUsername,
                description: "",
                feed_photo: feed_photo,
                type: 'public',
                is_group: false,
                feed_owner: user_id
            }, { transaction });
            //Create main channel
            const channel_id = v4();
            await FeedChannels.create({
                channel_id,
                channel_name: 'Main',
                feed_id,
                is_chat: false
            }, { transaction });
            await SavedPostChannels.create({
                channel_id: v4(),
                saver_id: feed_id,
                channel_name: "Main",
                display_order: 0
            }, { transaction });
            await transaction.commit();
            return done(null, newUser);
        } catch (error) {
            await transaction.rollback();
            return done(error);
        }
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async (user_id, done) => {
    try {
        const user = await Users.findByPk(user_id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
); 

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), async (req, res) => {
    try {
        const user = req.user;
        const feed = await Feeds.findOne({ 
            where: { feed_owner: user.user_id, is_group: false } 
        });
        const loginTime = new Date();
        req.session.user_id = user.user_id;
        req.session.username = user.username;
        req.session.email = user.email;
        req.session.has_membership = user.has_membership;
        req.theme = user.theme;
        req.usage_count = user.usage_count;
        req.storage_count = user.storage_count;
        req.session.viewer_id = feed.feed_id;
        req.session.last_active_at = loginTime;
        const connectedAccounts = await ConnectedAccounts.findAll({
            where: { user_id: user.user_id },
            attributes: ['platform', 'handle', 'instance_url', 'extra']
        });
        const algorithms = await Algorithms.findAll({
            where: { viewer_id: feed.feed_id },
            include: [{
            model: AlgorithmLocations,
            as: 'algorithm_locations'
            }],
            order: [['algorithm_name', 'ASC']]
        });
        const followedFeeds = await Followers.findAll({
            where: { follower_id: feed.feed_id },
            include: [{
            model: Feeds,
            as: 'followedFeed',
            }],
            order: [['followedFeed', 'feed_name', 'ASC']]
        });
        const normalizedFollowedFeeds = followedFeeds.map(follow => ({
            feed_id: follow.followedFeed.feed_id,
            feed_name: follow.followedFeed.feed_name,
            feed_photo: follow.followedFeed.feed_photo,
            link_type: follow.link_type,
            is_group: follow.followedFeed.is_group
        }));
        const deepFeeds = await DeepFeeds.findAll({
            where: { owner_id: feed.feed_id, parent_id: null },
            order: [['name', 'ASC']]
        });
        const recentUpvotes = await PostVotes.findAll({
            attributes: ['post_id'],
            where: { 
            voter_id: feed.feed_id,
            upvotes: { [Op.gt]: 0 },
            downvotes: { [Op.lte]: 0 }
            },
            order: [['updated_at', 'DESC']],
            limit: 100
        });
        await Users.update(
            { last_active_at: loginTime },
            { where: { user_id: user.user_id } }
        );
        //Store data in session for frontend to retrieve
        req.session.loginData = {
            user: {
                user_id: user.user_id,
                feed_name: user.username,
                email: user.email,
                has_membership: user.has_membership,
                theme: user.theme,
                usage_count: user.usage_count,
                storage_count: user.storage_count,
                viewer_id: feed.feed_id,
                feed_photo: feed.feed_photo,
                follow_requests: feed.follow_requests,
                connections: feed.connections,
                connect_requests: feed.connect_requests
            },
            algorithms,
            connectedAccounts,
            deepFeeds,
            followedFeeds: normalizedFollowedFeeds,
            recentUpvotes
        };
        //Redirect to frontend with success
        res.redirect(`${process.env.FRONTEND_URL}/auth/google/success`);
    } catch (error) {
        console.error(new Date().toISOString(), '/auth/google/callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
});

router.get('/auth/google/data', authenticateCheck, async (req, res) => {
    try {
        if (req.session.loginData) {
            const data = req.session.loginData;
            delete req.session.loginData; //Clear after retrieval
            return res.status(200).json({ success: true, ...data });
        }
        return res.status(404).json({ success: false, message: 'No login data found' });
    } catch (error) {
        console.error(new Date().toISOString(), '/auth/google/data error:', error);
        return res.status(500).json({ success: false });
    }
});

router.post('/change_password', resendLimiter, authenticateCheck, async (req, res) => { //For logged in users
    try {
        const { password, user_id } = req.body;
        const hashedPassword = await hash(password, 10);
        const user = await Users.findOne({ where: {user_id} });
        await user.update({ password: hashedPassword });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/change_password error:', error);
        res.status(500).json({ success: false });
    }
});

//Checks if user is logged in
router.get('/check_authentication', async (req, res) => {
    try {
        if (!req.session || !req.session.user_id) {
            return res.status(403).json({
                authenticated: false,
                feeds: null,
                user: null,
                currentFeed: null
            });
        }
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(403).json({
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
        console.error(new Date().toISOString(), '/check_authentication error:', error);
        return res.status(200).json({
            authenticated: false,
            feeds: null,
            user: null,
            currentFeed: null
        });
    }
});

//Deletes user account and all associated data
router.delete('/delete_account', resendLimiter, authenticateCheck, async (req, res) => {
    let transaction
    try {
        transaction = await sequelize.transaction();
        const { userId } = req.body;
        const feed = await Feeds.findOne({ where: { feed_owner: userId, is_group: false } });
        const id = feed.feed_id;
        const followed = await Followers.findAll({
            where: { follower_id: id },
            attributes: ['feed_id'],
            transaction,
        });
        for (const f of followed) {
            await Feeds.update(
                { follower_count: sequelize.literal('follower_count - 1') },
                { where: { feed_id: f.feed_id }, transaction }
            );
        }
        if (feed.feed_photo !== process.env.DEFAULT_USER_IMAGE) {
            await DeleteMedia(feed.feed_photo)
        }
        await FeedChannels.destroy({ where: { feed_id: id }, transaction });
        const userPosts = await Posts.findAll({
            where: { poster_id: id },
            attributes: ['post_id'],
            transaction,
        });
        const userPostIds = userPosts.map(p => p.post_id);
        if (userPostIds.length > 0) {
            await PostNotes.destroy({ where: { post_id: { [Op.in]: userPostIds } }, transaction });
            await PostVotes.destroy({ where: { post_id: { [Op.in]: userPostIds } }, transaction });
            await ViewedPosts.destroy({ where: { post_id: { [Op.in]: userPostIds } }, transaction }); //Views of user's posts
        }
        await ViewedPosts.destroy({ where: { viewer_id: id }, transaction }); //Views by user
        await Posts.destroy({ where: { feed_id: id, poster_id: id }, transaction }); //Only delete posts made to personal feed
        await PostDrafts.destroy({ where: { poster_id: id }, transaction });
        await Followers.destroy({ where: { follower_id: id }, transaction });
        await Connections.destroy({ where: { [Op.or]: [{ feed1_id: id }, { feed2_id: id }] }, transaction });
        await ConnectRequests.destroy({ where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] }, transaction });
        await FeedChats.destroy({ where: { feed_id: id }, transaction });
        await Messages.destroy({ where: { sender_id: userId }, transaction });
        await Feeds.destroy({ where: { feed_owner: userId, is_group: false }, transaction });
        await ConnectedAccounts.destroy({ where: { user_id: userId }, transaction });
        await ExternalPostsAccess.destroy({ where: { user_id: userId }, transaction });
        await Users.destroy({ where: { user_id: userId }, transaction });
        await transaction.commit();
        res.clearCookie('sid');
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/delete_account error:', error);
        if (transaction) await transaction.rollback();
        return res.status(500).json({ success: false });
    }
});

router.post('/forgot-password', resendLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const { valid, error } = ValidateEmail(email);
        if (!valid) {
            return res.status(400).json({ message: error });
        }
        const user = await Users.findOne({ where: { email } });
        if (!user) {
            //Always return success to avoid exposing user existence
            return res.status(200).json({ success: true });
        }
        const resetToken = jwt.sign(
            { email, type: 'password_reset', userId: user.user_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.update({
            reset_token: resetToken,
            reset_token_expires: resetExpires
        });
        await sendPasswordResetEmail(email, user.username, resetToken);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/forgot-password error:', error);
        return res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
    }
});

router.post('/join', loginLimiter, async (req, res) => {
    let transaction
    try {
		await new Promise((resolve, reject) => {
			req.session.regenerate(err => {
				if (err) reject(err);
				else resolve();
			});
		});
        const email = req.body.email;
        const username = req.body.username;
        const emailCheck = ValidateEmail(email);
        if (!emailCheck.valid) return res.status(400).json({ field: 'email', message: emailCheck.error });
        const usernameCheck = ValidateTextInput(username, 3, 30);
        if (!usernameCheck.valid) return res.status(400).json({ field: 'username', message: usernameCheck.error });
        const existingEmail = await Users.findOne({ where: { email } });
        if (existingEmail) return res.status(409).json({ message: 'Email already registered' });
        const existingUser = await Users.findOne({ where: { username } });
        if (existingUser) return res.status(409).json({ message: 'Username already taken' });
        transaction = await sequelize.transaction();
        const user_id = v4();
        const hashedPassword = await hash(req.body.password, 10);
        const UserSince = new Date();
        const verificationToken = generateVerificationToken(user_id, email);
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); //24 hours
        //ONLY FOR FIRST 1000 USERS
        const subscriptionExpiresAt = new Date();
        subscriptionExpiresAt.setFullYear(subscriptionExpiresAt.getFullYear() + 1);
        //Free membership for a year
        await Users.create({
            email, user_id, username, password: hashedPassword, UserSince, email_verified: false, verification_token: verificationToken, verification_token_expires: verificationTokenExpires, has_membership: true, subscription_expires_at: subscriptionExpiresAt
        }, { transaction });
        //Add initial user feed
        const default_photo = process.env.DEFAULT_USER_IMAGE;
        const feed_id = v4();
        await Feeds.create({
            feed_id, feed_name: username, description: "", feed_photo: default_photo, type: 'public', is_group: false, feed_owner: user_id
        }, { transaction });
        //Add main channel
        const channel_id = v4();
        await FeedChannels.create({
            channel_id, channel_name: 'Main', feed_id, is_chat: false
        }, { transaction });
        await SavedPostChannels.create({
            channel_id: v4(), saver_id: feed_id, channel_name: "Main", display_order: 0
        }, { transaction });
        //await Followers.create({
            //follow_id: v4(), follower_id: feed_id, feed_id: process.env.WELCOME_FEED_ID
        //, { transaction });
        //await PostDrafts.create({
            //draft_id: v4(), feed_id, channel_id, title: 'Edit this draft post using the edit button below', content: tutorialContent, poster_id: feed_id
        //}, { transaction });
        //await Feeds.increment('follower_count', { where: { feed_id: process.env.DEVELOPMENT_FEED_ID } }, { transaction });
        //await Feeds.increment('follower_count', { where: { feed_id: process.env.FEEDBACK_FEED_ID } }, { transaction });
        //await Feeds.increment('follower_count', { where: { feed_id: process.env.WELCOME_FEED_ID } }, { transaction });
        try {
            await sendVerificationEmail(email, username, verificationToken);
        } catch (emailError) {      
            if (transaction) await transaction.rollback();    
            return res.status(500).json({ success: false, message: 'Email send error' });
        }
        await transaction.commit();
        res.status(200).json({ success: true, message: 'Please check your email to verify your account.' });
    } catch (error) {
        console.error(new Date().toISOString(), '/join error:', error);
        if (transaction) await transaction.rollback();
        res.status(500).json({ success: false, message: 'Creation failed. Please try again.' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            req.session.regenerate(error => {
                if (error) reject(error);
                else resolve();
            });
        });
        const { password, usernameOrEmail } = req.body;
        if (typeof usernameOrEmail !== 'string' || usernameOrEmail.length > 320) {
            return res.status(400).json({ success: false, message: 'Invalid login input' });
        }
        const user = await Users.findOne({ where: { [Op.or]: [{ email: usernameOrEmail }, { username: usernameOrEmail }] } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Username not found' });
        }
        if (!user.email_verified) {
            return res.status(401).json({ success: false, message: 'Please verify your email before logging in.' });
        }
        if (user && await compare(password, user.password)) {
            const feed = await Feeds.findOne({ where: { feed_owner: user.user_id, is_group: false }}); //Each user can only own one non-group feed (their own)
            const loginTime = new Date();
            req.session.user_id = user.user_id;
            req.session.username = user.username;
            req.session.email = user.email;
            req.session.has_membership = user.has_membership;
            req.theme = user.theme;
            req.usage_count = user.usage_count;
            req.storage_count = user.storage_count;
            req.session.viewer_id = feed.feed_id;
            req.session.last_active_at = loginTime;
            const connectedAccounts = await ConnectedAccounts.findAll({
                where: { user_id: user.user_id },
                attributes: ['platform', 'handle', 'instance_url', 'extra']
            });
            const algorithms = await Algorithms.findAll({
                where: { viewer_id: feed.feed_id },
                include: [{
                    model: AlgorithmLocations,
                    as: 'algorithm_locations'
                }],
                order: [['algorithm_name', 'ASC']]
            });
            const followedFeeds = await Followers.findAll({
                where: { follower_id: feed.feed_id },
                include: [{
                    model: Feeds,
                    as: 'followedFeed',
                }],
                order: [['followedFeed', 'feed_name', 'ASC']]
            });
            //Normalise to flat structure
            const normalizedFollowedFeeds = followedFeeds.map(follow => ({
                feed_id: follow.followedFeed.feed_id,
                feed_name: follow.followedFeed.feed_name,
                feed_photo: follow.followedFeed.feed_photo,
                link_type: follow.link_type,
                is_group: follow.followedFeed.is_group
            }));
            const deepFeeds = await DeepFeeds.findAll({
                where: { owner_id: feed.feed_id, parent_id: null },
                order: [['name', 'ASC']]
            });
            const recentUpvotes = await PostVotes.findAll({
                attributes: ['post_id'],
                where: { 
                    voter_id: feed.feed_id,
                    upvotes: { [Op.gt]: 0 },
                    downvotes: { [Op.lte]: 0 }
                },
                order: [['updated_at', 'DESC']], //Most recent upvotes
                limit: 100
            });
            await Users.update(
                { last_active_at: loginTime },
                { where: { user_id: user.user_id },
            });
            res.status(200).json({ 
                success: true, 
                user: {
                    user_id: user.user_id,
                    feed_name: user.username,
                    email: user.email,
                    has_membership: user.has_membership,
                    theme: user.theme,
                    usage_count: user.usage_count,
                    storage_count: user.storage_count,
                    viewer_id: feed.feed_id,
                    feed_photo: feed.feed_photo,
                    follow_requests: feed.follow_requests,
                    connections: feed.connections,
                    connect_requests: feed.connect_requests
                },
                algorithms,
                connectedAccounts,
                deepFeeds,
                followedFeeds: normalizedFollowedFeeds, 
                recentUpvotes,
            });
        }
        else {
            res.status(401).json({ success: false, message: 'Incorrect password' });
        }
    }
    catch (error) {
        console.error(new Date().toISOString(), '/login error:', error);
        res.status(500).json({ success: false, message: 'Failed login' });
    }
});

router.post('/logout', loginLimiter, (req, res) => {
    req.session.destroy( error => {
        if (error) {
            console.error(new Date().toISOString(), '/logout error:', error);
            return res.status(500).json({ success: false });
        }
        res.clearCookie('sid');
        return res.status(200).json({ success: true });
    });
});

router.post('/resend-verification', resendLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const { valid, error } = ValidateEmail(email);
        if (!valid) {
            return res.status(400).json({ message: error });
        }
        const user = await Users.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.email_verified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }
        const verificationToken = generateVerificationToken(user.user_id, email);
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.update({
            verification_token: verificationToken,
            verification_token_expires: verificationTokenExpires
        });
        await sendVerificationEmail(email, user.username, verificationToken);
        return res.status(200).json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        console.error(new Date().toISOString(), '/resend-verification error:', error);
        return res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
    }
});

router.post('/reset-password', resendLimiter, async (req, res) => { //For users who have forgotten their password
	const { password, token } = req.body;
	let decoded;
	try {
		decoded = jwt.verify(token, process.env.JWT_SECRET);
	} catch {
		return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
	}
	if (decoded.type !== 'password_reset') {
		return res.status(400).json({ success: false, message: 'Invalid reset token' });
	}
	try {
		const user = await Users.findOne({
			where: {
				email: decoded.email,
				reset_token: token,
				user_id: decoded.userId
			}
		});
		if (!user || new Date() > user.reset_token_expires) {
			return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
		}
		const hashedPassword = await hash(password, 10);
		await user.update({
			password: hashedPassword,
			reset_token: null,
			reset_token_expires: null
		});
		return res.status(200).json({ success: true, message: 'Password reset successful' });
	} catch (error) {
        console.error(new Date().toISOString(), '/reset-password error:', error);
		return res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.get('/verify-email', resendLimiter, async (req, res) => {
	try {
		const { token } = req.query;
		if (!token) return res.status(400).json({ message: 'Verification token is required' });
		let decoded;
		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET);
		} catch (error) {
			return res.status(400).json({ message: 'Invalid or expired verification token' });
		}
		const user = await Users.findOne({
			where: {
				email: decoded.email,
				user_id: decoded.userId,
				verification_token: token
			}
		});
		if (!user) return res.status(404).json({ message: 'User not found or token invalid' });
		if (user.email_verified) return res.status(200).json({ message: 'Email already verified' });
		if (new Date() > user.verification_token_expires) return res.status(400).json({ message: 'Verification token has expired' });
		await user.update({
			email_verified: true,
			verification_token: null,
			verification_token_expires: null
		});
		const feed = await Feeds.findOne({ where: { feed_owner: user.user_id } });
		req.session.user_id = user.user_id;
		req.session.username = user.username;
		req.session.viewer_id = feed.feed_id;
		return res.status(200).json({
			success: true,
			message: 'Email verified successfully!',
			user: {
				user_id: user.user_id,
				feed_name: user.username,
				email: user.email,
				has_membership: user.has_membership,
				theme: user.theme,
				usage_count: user.usage_count,
				storage_count: user.storage_count,
				viewer_id: feed.feed_id,
				feed_photo: feed.feed_photo
			},
			followedFeeds: [],
			deepFeeds: [],
			recentUpvotes: []
		});
	} catch (error) {
        console.error(new Date().toISOString(), '/verify-email error:', error);
		return res.status(500).json({ message: 'Server error' });
	}
});

export default router;