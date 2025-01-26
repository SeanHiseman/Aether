import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Feeds, FeedChannels, Posts, PostNotes, PostVotes } from '../models/relationships.js';
import multer from 'multer';
import { Router } from 'express';
import path from 'path';
import { v4 } from 'uuid';

const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'created_at', 'updated_at', 'type', 'is_group', 'feed_owner'];
const noteAttributes = ['note_id', 'note_content', 'timestamp', 'is_misinfo']
const postAttributes = ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp', 'poster_id', 'points']
const router = Router();

router.get('/channel_posts', authenticateCheck, async (req, res) => {
    try {
        const { channelId, isSingle, feedId, postId } = req.query;
        const includeOptions = [{
            model: Feeds,
            as: 'poster',
            attributes: feedAttributes,
        }, {
            model: PostVotes,
            as: 'votes',
            attributes: ['vote_count'],
            required: false
        }, {
            model: PostNotes,
            as: 'note',
            attributes: noteAttributes,
            required: false
        }, {
            model: FeedChannels,
            as: 'parentChannel',
            attributes: ['channel_name'],
            required: false
        }];
        if (isSingle === 'true') {
            const post = await Posts.findOne({
                where: { post_id: postId,  
                    feed_id: feedId,
                    ...(channelId ? { channel_id: channelId } : {})
                },
                include: includeOptions,
                attributes: postAttributes,
            });
            if (!post) {
                return res.status(404).json({ success: false });
            }
            return res.status(200).json({ success: true, post });
        } 
        else {
            const whereChannel = {
                feed_id: feedId,
                ...(channelId ? { channel_id: channelId } : {}),
                parent_id: null
            };
            const posts = await Posts.findAll({
                where: whereChannel,
                include: includeOptions,
                attributes: postAttributes,
                order: [['timestamp', 'DESC']],
            });
            const finalResults = posts.map((post) => ({
                ...post.dataValues,
            }));
            //const sortedPosts = post_type === 'group' 
            //    ? sortPostsByWeightedRatio(finalResults, userId)
            //    : finalResults.sort((a, b) => b.timestamp - a.timestamp);
            return res.status(200).json(finalResults);
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/content_vote', authenticateCheck, async (req, res) => {
    try {
        const { contentId, feedId, voteType } = req.body;
        //Limits upvotes and downvotes on each post to 10
        if (voteType === 'check_vote') {
            const vote = await PostVotes.findOne({
                where: { content_id: contentId, voter_id: feedId },
            });
            if (!vote) { 
                return res.json({ success: true, message: 'no limit' });
            };
            if (vote.vote_count >= 10) {
                return res.json({ success: true, message: 'upvote limit' });
            } else if (vote.vote_count <= -10) {
                return res.json({ success: true, message: 'downvote limit' });
            } else {
                return res.json({ success: true, message: 'no limit' });
            }
        } else {
            const [vote, created] = await PostVotes.findOrCreate({
                where: { content_id: contentId, voter_id: feedId },
                defaults: { vote_id: v4() }
            });
            if (vote.vote_count >= 10 && voteType === 'upvote') {
                return res.json({ success: false, message: 'upvote limit'});
            } else if (vote.vote_count <= -10 && voteType === 'downvote') {
                return res.json({ success: false, message: 'downvote limit '});
            }
            //Update contentVotes table
            if (voteType === 'upvote') {
                vote.vote_count += 1;
            } else if (voteType === 'downvote') {
                vote.vote_count -= 1;
            }
            await vote.save();
            //Update individual posts
            const content = await Posts.findByPk(contentId);
            if (!content) {
                return res.status(404).json({ success: false, message: 'Content not found' });
            }
            if (voteType === 'upvote') {
                content.upvotes += 1;
            } else if (voteType === 'downvote') {
                content.downvotes += 1;
            }
            await content.save();
        }
        //Recalculate content points
        //content.points = calculatePoints(content.upvotes, content.downvotes, content.views);
        //Update user total points
        //const user = await Users.findByPk(content.poster_id);
        //user.points = await ProfilePosts.sum('points', { where: { poster_id: content.poster_id } });
        //await user.save();
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(404).json({ success: false });
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mediaDir = path.join(__dirname, '..', 'media', 'content');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}
//Checks input for post uploads
const postFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images and videos are allowed'));
    }
};

//Multer setup for post uploads
const post_storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, mediaDir);
    },
    filename: function (req, file, cb) {
        const uniqueFilename = `${v4()}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, uniqueFilename);
    }
});

//Uploads with file size limit
const post_upload = multer({
    storage: post_storage,
    limits: {
        fileSize: 1024 * 1024 * 1000 // 10MB limit
    },
    fileFilter: postFilter
})

router.post('/create_post', authenticateCheck, post_upload.array('files'), async (req, res) => {
    try {
        let { channel_id, content, feed_id, parent_id, post_id, poster_id, title } = req.body;
        if (!post_id) {
            post_id = v4();
        }
        content = content || '';
        const $ = cheerio.load(content, { decodeEntities: false });
        // Remove all img and video tags with blob URLs
        $('img[src^="blob:"], video[src^="blob:"]').remove();
        if (req.files && req.files.length > 0) {
            req.files.forEach((file) => {
                const fileType = file.mimetype.startsWith('image/') ? 'img' : 'video';
                let fileTag = '';
                if (fileType === 'img') {
                    fileTag = `<img src="/media/content/${file.filename}" alt="Uploaded Image">`;
                } else if (fileType === 'video') {
                    fileTag = `<video controls><source src="/media/content/${file.filename}" type="${file.mimetype}"></video>`;
                }
                $('body').append(fileTag);
            });
        }
        const modifiedContent = $.html();
        const post = await Posts.create({
            post_id,
            parent_id,
            feed_id,
            channel_id,
            title,
            content: modifiedContent,
            poster_id
        });
        if (parent_id) {
            const parentPost = await Posts.findOne({ where: { post_id: parent_id } });
            if (parentPost) {
                parentPost.replies += 1;
                await parentPost.save();
            }
        }
        return res.status(200).json({ success: true, post });
    } catch (error) {
        console.error("Error creating post:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});


router.post('/edit_post', authenticateCheck, post_upload.array('files'), async (req, res) => {
    try {
        const { post_id } = req.body;
        let { content, title } = req.body;
        const foundPost = await Posts.findByPk(post_id);
        if (!foundPost) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        foundPost.content = content;
        foundPost.title = title || foundPost.title;
        await foundPost.save();
        return res.status(201).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false });
    }
}); 

router.delete('/remove_post', authenticateCheck, async (req, res) => {
    try {
        const { post } = req.body;
        const foundPost = await Posts.findByPk(post.post_id);
        deleteMedia(foundPost.content);
        if (post.parent_id) {
            const parentPost = await Posts.findByPk(post.parent_id);
            parentPost.replies -= 1;
            await parentPost.save();
        }
        await Posts.destroy({ where: { post_id: post.post_id } })
        res.status(200).json({ success: true });
    } catch (error) {
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

router.get('/post_replies/:postId', authenticateCheck, async (req, res) => {
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
                attributes: ['vote_count'],
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
            order: [['timestamp', 'DESC']],
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
