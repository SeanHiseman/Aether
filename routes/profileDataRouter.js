import express from 'express';
import authenticateCheck from '../functions/authenticateCheck.js';
import { Users, Profiles } from '../models/models.js';
const router = express.Router();

//Route to fetch profile data for a user
router.get('/profileDataRouter/:userId', authenticateCheck, async (req, res) => {
    const columns = ['profile_id', 'profile_photo', 'bio', 'follower_count', 'is_private'];

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
        const profileData = {
            logged_in_user_id: userId,
            logged_in_profile_id: profile.profile_id,
            logged_in_username: req.session.username,
            logged_in_profile_photo: profile.profile_photo,
            bio: profile.bio,
            follower_count: profile.follower_count,
            is_private: profile.is_private,
            has_membership: user.has_membership
        };
        res.json(profileData);

    } catch (error) {
        res.status(500).send('Server error');
    }
});

export default router;