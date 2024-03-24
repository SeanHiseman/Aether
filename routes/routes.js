import { Router } from 'express';
import { Friends, ProfilePosts, Profiles, Users } from '../models/models.js'; 
import authenticateCheck from '../functions/authenticateCheck.js';
import { Op } from 'sequelize';
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

        //Limits upvotes and downvotes on each post to 10
        if (vote.vote_count === 10 && vote_type === 'upvote') {
            return res.json({ success: false, message: 'Upvote limit' });
        } else if (vote.vote_count === -10 && vote_type === 'downvote') {
            return res.json({ success: false, message: 'downvote limit' });
        }

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

router.get('/friend_posts', authenticateCheck, async (req, res)=> {
    try {
        const user_id = req.session.user_id;
        const friends = await Friends.findAll({
            where: {
                [Op.or]: [
                    { user1_id: user_id },
                    { user2_id: user_id }
                ]
            },
            attributes: ['user1_id', 'user2_id']
        });

        //Get friend IDs, since the user might be in either column
        const friendIds = friends.reduce((acc, friend) => {
            if (friend.user1_id !== user_id && !acc.includes(friend.user1_id)) acc.push(friend.user1_id);
            if (friend.user2_id !== user_id && !acc.includes(friend.user2_id)) acc.push(friend.user2_id);
            return acc;
        }, []);

        const posts = await ProfilePosts.findAll({
            where: {
                poster_id: { [Op.in]: friendIds }
            },
            include: [{
                model: Users,
                as: 'ProfilePoster',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo'],
                }]
            }],
            //Posts sorted chronilogically
            order: [['timestamp', 'DESC']]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
});

router.get('/get_current_user', authenticateCheck, (req, res) => {
    const userId = req.session.user_id;
    if (userId) {
        return res.json({ user_id: userId });
    }
    return res.status(401).json({ "error": "No user logged in" });
});

//Home route
router.get('/home', authenticateCheck, async (req, res) => {
        res.json({
            //nothing yet
        });
});

//Recommended route (currently just return all posts, will be changed)
router.get('/recommended', authenticateCheck, async (req, res) => {
    const recommended_content = await ProfilePosts.findAll({
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



