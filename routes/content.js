import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Feeds, FeedChannels, Posts, PostNotes, PostVotes, Users } from '../models/relationships.js';
import multer from 'multer';
import { Router } from 'express';
import path from 'path';
import { Sequelize } from 'sequelize';
import { v4 } from 'uuid';
import sequelize from '../databaseSetup.js';

const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'created_at', 'updated_at', 'type', 'is_group', 'feed_owner', 'is_locked'];
const noteAttributes = ['note_id', 'note_content', 'created_at', 'updated_at', 'is_misinfo']
const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'created_at', 'updated_at', 'poster_id', 'points']
const router = Router();

const calculateFileSizes = (files) => {
    return files.reduce((total, file) => total + file.size, 0) / (1024 * 1024);
};

const checkStorageLimit = async (req, res, next) => {
    try {
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const maxStorage = user.has_membership ? 100 * 1024 : 100; //100GB for members, 100MB for non-members
        if (user.storage_count >= maxStorage) {
            return res.status(413).json({ 
                success: false, 
                message: `Weekly limit of ${maxStorage}MB exceeded` 
            });
        }
        req.currentUser = user;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

router.get('/channel_posts', async (req, res) => {
    try {
        const { channelId, feedId, isSingle, limit, offset, postId } = req.query;
        const includeOptions = [{
            model: Feeds,
            as: 'poster',
            attributes: feedAttributes,
        }, {
            model: PostVotes,
            as: 'votes',
            attributes: ['upvotes', 'downvotes'],
            required: false
        }, {
            model: PostNotes,
            as: 'note',
            attributes: noteAttributes,
            required: false
        }, {
            model: FeedChannels,
            as: 'parentChannel',
            attributes: ['channel_id', 'channel_name'],
            required: false
        }];
        if (isSingle === 'true') {
            const post = await Posts.findOne({
                attributes: postAttributes,
                include: includeOptions,
                where: { feed_id: feedId, post_id: postId, ...(channelId ? { channel_id: channelId } : {}) },
            });
            if (!post) return res.status(404).json({ success: false });
            return res.status(200).json({ success: true, post });
        } 
        else {
            const whereChannel = {
                feed_id: feedId,
                parent_id: null,
                ...(channelId ? { channel_id: channelId } : {}),
            };
            const posts = await Posts.findAll({
                attributes: postAttributes,
                include: includeOptions,
                limit: limit ? parseInt(limit, 10) : 10,
                offset: offset ? parseInt(offset, 10) : 0,
                order: [['created_at', 'DESC']],
                where: whereChannel,
            });
            const finalResults = posts.map((post) => ({ ...post.dataValues }));
            //const sortedPosts = post_type === 'group' 
            //    ? sortPostsByWeightedRatio(finalResults, userId)
            //    : finalResults.sort((a, b) => b.created_at - a.created_at);
            return res.status(200).json(finalResults);
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/content_vote', authenticateCheck, async (req, res) => {
    try {
        const { postId, feedId, voteType } = req.body; //feedId refers to the user who is voting
        const content = await Posts.findByPk(postId);
        if (!content) {
            return res.status(404).json({ success: false, message: 'Content not found' });
        }
        const [vote, created] = await PostVotes.findOrCreate({
            where: { post_id: postId, voter_id: feedId },
            defaults: {
                vote_id: v4(),
                upvotes: 0,
                downvotes: 0,
            }
        });
        const currentNetVote = vote.upvotes - vote.downvotes;
        if (voteType === 'check_vote') {
            return res.status(200).json({
                success: true,
                message: 'vote status',
                reachedUpvoteLimit: currentNetVote >= 10,
                reachedDownvoteLimit: currentNetVote <= -10,
                currentUpvotes: vote.upvotes,
                currentDownvotes: vote.downvotes,
                netVote: currentNetVote
            });
        }
        if (voteType === 'upvote') {
            if (currentNetVote < 10) {
                if (vote.downvotes > 0) {
                    vote.downvotes -= 1;
                    content.downvotes -= 1;
                } else {
                    vote.upvotes += 1;
                    content.upvotes += 1;
                }
            } else {
                return res.status(200).json({
                    success: false,
                    message: 'upvote limit',
                    reachedUpvoteLimit: true,
                    reachedDownvoteLimit: currentNetVote <= -10
                });
            }
        } else if (voteType === 'downvote') {
            if (currentNetVote > -10) {
                if (vote.upvotes > 0) {
                    vote.upvotes -= 1;
                    content.upvotes -= 1;
                } else {
                    vote.downvotes += 1;
                    content.downvotes += 1;
                }
            } else {
                return res.status(200).json({
                    success: false,
                    message: 'downvote limit',
                    reachedUpvoteLimit: currentNetVote >= 10,
                    reachedDownvoteLimit: true
                });
            }
        }
        await vote.save();
        await content.save();
        const newNetVote = vote.upvotes - vote.downvotes;
        return res.status(200).json({
            success: true,
            upvotes: content.upvotes,
            downvotes: content.downvotes,
            netVote: newNetVote,
            reachedUpvoteLimit: newNetVote >= 10,
            reachedDownvoteLimit: newNetVote <= -10
        });
    } catch (error) {
        return res.status(500).json({ success: false });
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mediaDir = path.join(__dirname, '..', 'media', 'content');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

const postFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (!mimetype || !extname) {
        return cb(new Error('Only images and videos are allowed'));
    }
    const maxSize = (req.session?.user?.has_membership ? 100 : 1) * 1024 * 1024;
    if (file.size > maxSize) {
        return cb(new Error(`File exceeds the limit of ${maxSize / (1024 * 1024)}MB`));
    }
    cb(null, true);
};

const post_storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaDir);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = `${v4()}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, uniqueFilename);
    }
});

const post_upload = multer({
    fileFilter: postFilter,
    storage: post_storage
});

router.post('/create_post', authenticateCheck, checkStorageLimit, post_upload.array('files'), async (req, res) => {
    try {
        let { channel_id, content, feed_id, parent_id, post_id, poster_id, title } = req.body;
        if (!post_id) {
            post_id = v4();
        }
        content = content || '';
        const $ = cheerio.load(content, { decodeEntities: false });
        if (req.files && req.files.length > 0) {
            const totalFileSize = calculateFileSizes(req.files);
            const user = req.currentUser;
            const maxStorage = user.has_membership ? 100 * 1024 : 100; //100GB for members, 100MB for non-members
            if (user.storage_count + totalFileSize > maxStorage) {
                req.files.forEach(file => {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                });
                return res.status(413).json({ 
                    success: false, 
                    message: `Weekly limit of ${maxStorage}MB exceeded` 
                });
            }
            user.storage_count += totalFileSize;
            await user.save();
            let index = 0;
            $('img[src^="blob:"], video[src^="blob:"]').each((i, el) => {
                if (index < req.files.length) {
                    const file = req.files[index];
                    const fileType = file.mimetype.startsWith('image/') ? 'img' : 'video';
                    if (fileType === 'img') {
                        $(el).attr('src', `/media/content/${file.filename}`);
                        $(el).removeAttr('blob:');
                        $(el).attr('alt', 'Uploaded Image');
                    } else {
                        $(el).empty();
                        $(el).append(`<source src="/media/content/${file.filename}" type="${file.mimetype}">`);
                    }
                    index++;
                }
            });
        }
        const modifiedContent = $.html();
        const post = await Posts.create({
            channel_id,
            content: modifiedContent,
            feed_id,
            parent_id,
            post_id,
            poster_id,
            title
        });
        if (parent_id) { //parent_id means post is a reply
            const parentPost = await Posts.findOne({ where: { post_id: parent_id } });
            if (parentPost) {
                parentPost.replies += 1;
                await parentPost.save();
            }
        }
        return res.status(200).json({ success: true, post });
    } catch (error) {
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                } catch (err) {
                    console.error('Error deleting file:', err);
                }
            });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/edit_post', authenticateCheck, checkStorageLimit, post_upload.array('files'), async (req, res) => {
    try {
        let { content, post_id, title } = req.body;;
        const foundPost = await Posts.findByPk(post_id);
        if (!foundPost) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        const $ = cheerio.load(content, { decodeEntities: false });
        if (req.files && req.files.length > 0) {
            const totalFileSize = calculateFileSizes(req.files);
            const user = req.currentUser;
            const maxStorage = user.has_membership ? 100 * 1024 : 100; //100GB for members, 100MB for non-members
            if (user.storage_count + totalFileSize > maxStorage) {
                req.files.forEach(file => {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                });
                return res.status(413).json({ 
                    success: false, 
                    message: `Weekly limit of ${maxStorage}MB exceeded` 
                });
            }
            user.storage_count += totalFileSize;
            await user.save();
            let index = 0;
            $('img[src^="blob:"], video[src^="blob:"]').each((i, el) => {
                if (index < req.files.length) {
                    const file = req.files[index];
                    const fileType = file.mimetype.startsWith('image/') ? 'img' : 'video';
                    if (fileType === 'img') {
                        $(el).attr('src', `/media/content/${file.filename}`);
                        $(el).removeAttr('blob:');
                        $(el).attr('alt', 'Uploaded Image');
                    } else {
                        $(el).empty();
                        $(el).append(`<source src="/media/content/${file.filename}" type="${file.mimetype}">`);
                    }
                    index++;
                }
            });
        }
        foundPost.content = $.html();
        if (title) {
            foundPost.title = title;
        }
        foundPost.updated_at = Sequelize.literal('CURRENT_TIMESTAMP(3)');
        await foundPost.save();
        return res.status(201).json({ success: true });
    } catch (error) {
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                } catch (err) {
                    console.error('Error deleting file:', err);
                }
            });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/remove_post', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { post } = req.body;
        const foundPost = await Posts.findByPk(post.post_id);
        deleteMedia(foundPost.content);
        if (post.parent_id) {
            const parentPost = await Posts.findByPk(post.parent_id);
            parentPost.replies -= 1;
            await parentPost.save();
        }
        await PostVotes.destroy({ where: { post_id: post.post_id }, transaction: transaction });
        await PostNotes.destroy({ where: { post_id: post.post_id }, transaction: transaction });
        await Posts.destroy({ where: { post_id: post.post_id }, transaction: transaction });
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ success: false });
    }
});

router.post('/increment_views', authenticateCheck, async (req, res) => {
    try {
        const { postId } = req.body;
        const post = await Posts.findByPk(postId);
        post.views += 1;
        //Update post points
        //post.points = calculatePoints(post.upvotes, post.downvotes, post.views);
        await post.save();
        //Update user points
        //const user = await Users.findByPk(post.poster_id);
        //user.points = await ProfilePosts.sum('points', { where: { poster_id: post.poster_id } });
        //await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });   
    }
});

router.get('/post_replies/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const parentPost = await Posts.findOne({ where: { post_id: postId } });
        if (!parentPost) {
            return res.status(404).json({ success: false, message: 'Parent post not found.' });
        }
        const includeOptions = [{
                model: Feeds,
                as: 'poster',
                attributes: feedAttributes,
            },{
                model: PostVotes,
                as: 'votes',
                attributes: ['upvotes', 'downvotes'],
                required: false
            },{
                model: PostNotes,
                as: 'note',
                attributes: noteAttributes,
                required: false
            },{
                model: FeedChannels,
                as: 'parentChannel',
                attributes: ['channel_name'],
                required: false
            }
        ];
        const parentFeedId = parentPost.feed_id;
        const parentChannelId = parentPost.channel_id;
        const whereClause = {
            parent_id: postId,
            ...(parentFeedId ? { feed_id: parentFeedId } : {}),
            ...(parentChannelId ? { channel_id: parentChannelId} : {})
        };
        const replies = await Posts.findAll({
            where: whereClause,
            include: includeOptions,
            attributes: postAttributes,
            order: [['created_at', 'DESC']],
        });
        const formattedReplies = replies.map(reply => ({
            ...reply.dataValues,
        }));
        return res.status(200).json(formattedReplies);
    } catch (error) {
        return res.status(500).json({ success: false });
    }
});

export default router;
