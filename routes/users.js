import authenticateCheck from '../functions/checks/authenticateCheck.js';
import sortPostsByWeightedRatio from'../functions/postSorting.js';
import { Users } from '../models/users.js';
import { Router } from 'express';

const router = Router();

//Changes user colour theme
router.post('/change_theme', authenticateCheck, async (req, res) => {
    try {
        const { theme } = req.body;
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        await Users.update(
            { theme: theme },
            { where: { user_id: userId } }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/change_username', authenticateCheck, async (req, res) => {
    try {
        const { username, userId } = req.body;
        const user = await Users.findOne({ where: { user_id: userId } });
        user.username = username;
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_theme', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.json({ theme: 'dark'});
        }
        const user = await Users.findOne({
            where: { user_id: userId },
            attributes: ['theme']
        });
        if (!user) {
            return res.json({ theme: 'dark'});
        }
        res.json({ theme: user.theme });
    } catch (error) {
        res.status(500).json({ success: false }); 
    }
});

export default router;



