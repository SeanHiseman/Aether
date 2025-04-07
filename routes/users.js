import authenticateCheck from '../functions/checks/authenticateCheck.js';
import sortPostsByWeightedRatio from'../functions/postSorting.js';
import { Feeds, Users } from '../models/relationships.js';
import { Router } from 'express';

const router = Router();

router.post('/change_email', authenticateCheck, async (req, res) => {
    try {
        const { email, userId } = req.body;
        const user = await Users.findOne({ where: { user_id: userId } });
        user.email = email;
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Changes user colour theme
router.post('/change_theme', authenticateCheck, async (req, res) => {
	try {
        const userId = req.session.user_id;
        let { theme } = req.body;
        if (typeof theme === 'object') {
            theme = JSON.stringify(theme);
        }
		await Users.update({ theme: theme }, { where: { user_id: userId } });
		res.status(200).json({ success: true });
	} catch (error) {
		res.status(500).json({ success: false });
	}
});

router.post('/change_username', authenticateCheck, async (req, res) => {
    try {
        const { feed_id, newName, user_id } = req.body;
        const feed = await Feeds.findOne({ where: { feed_id } });
        const user = await Users.findOne({ where: { user_id } });
        feed.feed_name = newName;
        user.username = newName;
        await feed.save();
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_theme', async (req, res) => {
    try {
        const userId = req.session && req.session.user_id;
        if (!userId) {
            return res.status(200).json({ theme: 'dark'});
        }
        const user = await Users.findOne({
            where: { user_id: userId },
            attributes: ['theme']
        });
        if (!user) {
            return res.status(200).json({ theme: 'dark'});
        }
        res.json({ theme: user.theme });
    } catch (error) {
        res.status(500).json({ success: false }); 
    }
});

export default router;



