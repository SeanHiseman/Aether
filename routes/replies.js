import authenticateCheck from '../functions/authenticateCheck.js';
import { Comments, ProfilePosts, Profiles, Users } from '../models/models.js';
import { Router } from 'express';
import { v4 } from 'uuid';

const router = Router();

//Add Comment Route
router.post('/add_reply', authenticateCheck, async (req, res) => {
    try {
        const { post_id, parent_id, content } = req.body;
        const commenter_id = req.session.user_id; 

        if (!post_id || !content) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const comment_id = v4();
        const newComment = await Comments.create({ 
            comment_id, post_id, commenter_id, content, likes: 0, dislikes: 0, timestamp: new Date(), parent_id 
        });

        const contentToUpdate = await ProfilePosts.findByPk(post_id);
        contentToUpdate.comments += 1;
        await contentToUpdate.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Get Comments Route 
router.get('/get_comments/:postId', authenticateCheck, async (req, res) => {
    try {
        const postId = req.params.postId;
        const comments = await Comments.findAll({
            where: { post_id: postId },
            include: [{
                model: Users,
                as: 'Commenter',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }]
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Up or downvote a reply
router.post('/reply_vote', authenticateCheck, async (req, res) => {
    try {
        const { comment_id, vote_type } = req.body;
        if (!comment_id || !['upvote', 'downvote'].includes(vote_type)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing parameters' });
        }

        const replyToUpdate = await Comments.findByPk(comment_id);
        if (!replyToUpdate) {
            return res.status(404).json({ success: false, message: 'Reply not found' });
        }

        if (vote_type === 'upvote') {
            replyToUpdate.likes += 1;
        } else {
            replyToUpdate.dislikes += 1;
        }

        await replyToUpdate.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
