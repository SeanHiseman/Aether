import { Router } from 'express';
import profileData from '../public/profileData.js'; 
const router = Router();

//Group home page route
router.get('/group', async (req, res) => {
    //Check if the user is logged in
    if (!req.session.user_id) {
        return res.redirect('/login'); 
    }

    const profile_data = await profileData(req, ['profile_id', 'profile_photo']);

    if (profile_data) {
        const [logged_in_profile_id, logged_in_profile_photo] = profile_data;
        res.render('base', {
            content: 'groups/groupHome',
            user_id: req.session.user_id,
            logged_in_username: req.session.username,
            logged_in_profile_id,
            logged_in_profile_photo
        });
    } else {
        res.render('base', { 
            content: 'groups/groupHome',
            user_id: req.session.user_id 
        });
    }
});
export default router;