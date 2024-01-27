import { Router } from 'express';
import { Posts, Profiles, Users } from '../models/models.js'; 
import authenticateCheck from '../functions/authenticateCheck.js';
import { Op } from 'sequelize';
const router = Router();

//Home route
router.get('/home', authenticateCheck, async (req, res) => {
        res.json({
            content: 'home',
            user_id: req.session.user_id,
        });
});

//Recommended route (currently just return all posts, will be changed)
router.get('/recommended', authenticateCheck, async (req, res) => {
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
    });
});

//Search route (currently just searches for matching strings, more advanced search is being worked on)
router.get('/search', authenticateCheck, async (req, res) => {
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
    });
});

export default router;



