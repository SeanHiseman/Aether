import { Router } from 'express';
import { ProfilePosts } from '../models/models.js'; 

const router = Router();

router.post('/:action/:contentId', async (req, res) => {
    const { action, contentId } = req.params;
    const content = await ProfilePosts.findByPk(contentId);
    if (content) {
        if (action === 'like') {
            content.likes += 1;
        } else if (action === 'dislike') {
            content.dislikes += 1;
        }
        await content.save();
        return res.json({ success: true });
    }
    return res.status(404).json({ success: false });
});

router.get('/get_current_user', (req, res) => {
    const userId = req.session.user_id;
    if (userId) {
        return res.json({ user_id: userId });
    }
    return res.status(401).json({ "error": "No user logged in" });
});

export default router;
