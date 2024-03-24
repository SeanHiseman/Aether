import authenticateCheck from '../functions/authenticateCheck.js';
import { GroupComments, GroupPosts, ProfileComments, ProfilePosts, Profiles, ReplyVotes, Users } from '../models/models.js';
import { Router } from 'express';
import { v4 } from 'uuid';

const router = Router();

//Add reply Route
router.post('/add_reply', authenticateCheck, async (req, res) => {
    try {
        const { content, isGroup, parent_id, post_id } = req.body;
        const commenter_id = req.session.user_id; 
        const post_type = isGroup ? 'group_post' : 'profile_post'; 

        if (!post_id || !content) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const comment_id = v4();
        const CommentModel = isGroup ? GroupComments : ProfileComments;
        await CommentModel.create({ 
            comment_id, post_id, post_type, commenter_id, content, likes: 0, dislikes: 0, timestamp: new Date(), parent_id 
        });

        //Depends on if post is in profile or group
        const PostModel = isGroup ? GroupPosts : ProfilePosts;
        const contentToUpdate = await PostModel.findByPk(post_id);
        contentToUpdate.comments += 1;
        await contentToUpdate.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Get Comments Route 
router.get('/get_comments/:postId', authenticateCheck, async (req, res) => {
    //try {
        const isGroup = req.query.isGroup === 'true';
        const postId = req.params.postId;
        const CommentModel = isGroup ? GroupComments : ProfileComments;
        const comments = await CommentModel.findAll({
            where: { post_id: postId },
            include: [{
                model: Users,
                as: isGroup ? 'GroupCommenter' : 'ProfileCommenter',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }]
        });
        res.json(comments);
    //} catch (error) {
        //res.status(500).json({ success: false, message: error.message });
    //}
});

//Up or downvote a reply
router.post('/reply_vote', authenticateCheck, async (req, res) => {
    try {
        const { comment_id, isGroup, vote_type } = req.body;
        const userId = req.session.user_id;

        const [vote] = await ReplyVotes.findOrCreate({
            where: {
                reply_id: comment_id,
                user_id: userId
            },
            defaults: {
                vote_id: v4(),
            }
        });

        //Limits upvotes and downvotes on each reply to 10
        if (vote.vote_count === 10 && vote_type === 'upvote') {
            return res.json({ success: false, message: 'Upvote limit' });
        } else if (vote.vote_count === -10 && vote_type === 'downvote') {
            return res.json({ success: false, message: 'downvote limit' });
        }

        if (vote_type === 'upvote') {
            vote.vote_count += 1; 
        } else if (vote_type === 'downvote') {
            vote.vote_count -= 1; 
        }
        await vote.save();

        const CommentModel = isGroup ? GroupComments : ProfileComments;

        const replyToUpdate = await CommentModel.findByPk(comment_id);
        if (vote_type === 'upvote') {
            replyToUpdate.likes += 1;
        } else if (vote_type === 'downvote') {
            replyToUpdate.dislikes += 1;
        }

        await replyToUpdate.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
