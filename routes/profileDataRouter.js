import express from 'express';
import authenticateCheck from '../functions/authenticateCheck.js';
import { Users, Profiles } from '../models/models.js';
const router = express.Router();

//Route to fetch profile data for a user
router.get('/profileDataRouter/:userId', authenticateCheck, async (req, res) => {
    const validColumns = new Set(['profile_id,', 'user_id', 'profile_photo', 'bio']);
    const columns = ['profile_id', 'profile_photo', 'bio'];

    //Validate column names to prevent SQL injection
    //if (!columns.every(col => validColumns.has(col))) {
        //return res.status(400).send('Invalid column names');
    //}

    const userId = req.params.userId;

    try {
        const user = await Users.findOne({
            where: { user_id: userId },
            include: [{
                model: Profiles,
                attributes: columns
            }]
        });

        const profile = user?.dataValues.profile;
        if (profile) {
            const profileData = {
                logged_in_user_id: userId,
                logged_in_profile_id: profile.profile_id,
                logged_in_username: req.session.username,
                logged_in_profile_photo: profile.profile_photo,
                bio: profile.bio
            };
            res.json(profileData);
        } else {
            res.status(404).send('Profile not found');
        }
    } catch (error) {
        console.error('Server error: ', error);
        res.status(500).send('Server error');
    }
});

export default router;