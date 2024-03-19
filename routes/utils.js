import { Router } from 'express';
import { v4 } from 'uuid';
import authenticateCheck from '../functions/authenticateCheck.js';
import { ContentVotes, GroupPosts, ProfilePosts } from '../models/models.js'; 

const router = Router();

//Up or downvote content
router.post('/content_vote', authenticateCheck, async (req, res) => {
    try {
        const { content_id, isGroup, vote_type } = req.body;
        const userId = req.session.user_id;
    
        const [vote] = await ContentVotes.findOrCreate({
            where: {
                content_id: content_id,
                user_id: userId
            },
            defaults: {
                vote_id: v4(),
            }
        });

        if (vote_type === 'upvote') {
            vote.vote_count += 1; 
        } else if (vote_type === 'downvote') {
            vote.vote_count -= 1; 
        }
        await vote.save();

        const PostModel = isGroup ? GroupPosts : ProfilePosts;
        const content = await PostModel.findByPk(content_id);
        if (vote_type === 'upvote') {
            content.likes += 1;
        } else if (vote_type === 'downvote') {
            content.dislikes += 1;
        }
        await content.save();
        return res.json({ success: true });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
});

router.get('/get_current_user', (req, res) => {
    const userId = req.session.user_id;
    if (userId) {
        return res.json({ user_id: userId });
    }
    return res.status(401).json({ "error": "No user logged in" });
});

export default router;
