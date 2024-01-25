import { Router } from 'express';
import { Posts, Profiles, Users } from '../models/models.js'; 
import profileData from '../functions/profileData.js'; 
import { Op } from 'sequelize';
const router = Router();

//Home route
router.get('/home', async (req, res) => {
    //Redirect user if not logged in
    if (!req.session.user_id) {
        return res.redirect('/login');
    }

    const profile_data = await profileData(req, ['profile_id', 'profile_photo']);
    if (profile_data) {
        const [logged_in_profile_id, logged_in_profile_photo] = profile_data;
        res.json({
            content: 'home',
            user_id: req.session.user_id,
            logged_in_username: req.session.username,
            logged_in_profile_id,
            logged_in_profile_photo
        });
    } else {
        res.json({ 
            content: 'home',
            user_id: req.session.user_id 
        });
    }
});

//Recommended route (currently just return all posts, will be changed)
router.get('/recommended', async (req, res) => {
    //Check if the user is logged in
    if (!req.session.user_id) {
        return res.redirect('/login');
    }

    const [logged_in_profile_id, logged_in_profile_photo] = await profileData(req, ['profile_id', 'profile_photo']);

    const recommended_content = await Posts.findAll({
        include: [{
            model: Users,
            include: [Profiles]
        }]
    });

    recommended_content.forEach(item => {
        item.username = item.User.username || 'Anonymous';
        item.profile_id = item.User.Profile.profile_id || {};
        item.profile_photo = item.User.Profile.profile_photo;
    });

    res.json({
        content: 'content_feed',
        content_items: recommended_content,
        user_id: req.session.user_id,
        logged_in_username: req.session.username,
        logged_in_profile_id,
        logged_in_profile_photo
    });
});

//Search route (currently just searches for matching strings, more advanced search is being worked on)
router.get('/search', async (req, res) => {
    //Check if the user is logged in
    if (!req.session.user_id) {
        return res.redirect('/login');
    }

    //Get logged-in user's profile data
    const [logged_in_profile_id, logged_in_profile_photo] = await profileData(req, ['profile_id', 'profile_photo']);

    //Retrieve the keyword from query parameters
    const keyword = req.query.keyword || '';

    //Search for content that matches the keyword in the title
    const results = await Posts.findAll({
        where: {
            title: {
                [Op.like]: '%' + keyword + '%'
            }
        },
        include: [{
            model: Users,
            include: [Profiles]
        }]
    });

    //Search results with user and profile info
    results.forEach(item => {
        item.username = item.user.username || 'Anonymous';
        item.profile_id = item.user.profile.profile_id;
        item.profile_photo = item.user.profile.profile_photo;
    });

    //Render the results using a view template
    res.json({
        content: 'content_feed',
        content_items: results,
        user_id: req.session.user_id,
        logged_in_username: req.session.username,
        logged_in_profile_id,
        logged_in_profile_photo
    });
});

export default router;



