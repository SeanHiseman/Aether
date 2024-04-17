import { Router } from 'express';
import { ContentVotes, Followers, Friends, Groups, GroupPosts, ProfilePosts, Profiles, Users, ProfileChannels, UserGroups } from '../models/models.js'; 
import authenticateCheck from '../functions/authenticateCheck.js';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
const router = Router();

//Up or downvote content
router.post('/content_vote', authenticateCheck, async (req, res) => {
    try {
        const { content_id, isGroup, vote_type } = req.body;
        const userId = req.session.user_id;
    
        const [vote] = await ContentVotes.findOrCreate({
            where: { content_id: content_id, user_id: userId },
            defaults: { vote_id: v4(), vote_count: 0 },
        });

        //Limits upvotes and downvotes on each post to 10
        if (vote_type === 'upvote') {
            vote.vote_count = Math.min(vote.vote_count + 1, 10);
        } else if (vote_type === 'downvote') {
            vote.vote_count = Math.max(vote.vote_count - 1, -10);
        }

        await vote.save();

        const PostModel = isGroup ? GroupPosts : ProfilePosts;
        const content = await PostModel.findByPk(content_id);
        if (vote_type === 'upvote') {
            content.upvotes += 1;
        } else if (vote_type === 'downvote') {
            content.downvotes += 1;
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

//Profiles and groups followed/joined by user
router.get('/following_posts', authenticateCheck, async (req, res)=> {
    //try {
        const userId = req.session.user_id;
        const followedProfiles= await Followers.findAll({
            where: { follower_id: userId },
                include: [{
                    model: Profiles,
                    include: [{
                        model: ProfilePosts,
                        attributes: ['post_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp'],
                    }]
                }]
        });
        console.log("followedProfiles:", followedProfiles);
        const userGroups = await UserGroups.findAll({
            where: { user_id: userId },
            include: [{
                model: Groups,
                through: { model: Users },
                include: [{
                    model: GroupPosts,
                    attributes: ['post_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp'],
                }]
            }]
        })
        console.log("userGroups:", userGroups);
        const posts = [
            ...followedProfiles.flatMap((profile) => 
                profile.Profiles.ProfilePosts.map((post) => ({
                    ...post.toJSON(),
                    isGroup: false,
                }))
            ),
            ...userGroups.Groups.flatMap((group) =>
                group.GroupPosts.map((post) => ({
                    ...post.toJSON(), 
                    isGroup: true,
                }))
            )
        ];
        console.log("posts:", posts);
        res.json(posts);
    //} catch (error) {
        //res.status(500).json({ success: false, message: error.message });   
    //}
});

router.get('/get_current_user', authenticateCheck, (req, res) => {
    const userId = req.session.user_id;
    if (userId) {
        return res.json({ user_id: userId });
    }
    return res.status(401).json({ "error": "No user logged in" });
});

//Adds one view to a piece of content
router.post('/increment_views', async (req, res) => {
    const { isGroup, postId } = req.body;
    try {
        const post = isGroup ? await GroupPosts.findByPk(postId) : await ProfilePosts.findByPk(postId);
        post.views += 1;
        await post.save();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
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

//Allows post to be taken down either by the user or moderators
router.delete('/remove_post', authenticateCheck, async (req, res) => {
    try {
        const { isGroup, post_id } = req.body;
        const postModel = isGroup ? GroupPosts : ProfilePosts;
        await postModel.destroy({ where: { post_id }});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Searches groups
router.get('/search/groups', authenticateCheck, async (req, res) => {
    try {
        const keyword = req.query.keyword.toLowerCase();
        const groupResults = await Groups.findAll({
            where: {
                group_name: {
                    [Op.iLike]: `%${keyword}%`,
                },
            },
            attributes: ['group_id', 'group_name', 'description', 'group_photo'],
        });
    
        res.json(groupResults);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message }); 
    }
});

//Searches posts
router.get('/search/posts', authenticateCheck, async (req, res) => {
    try {
        const keyword = req.query.keyword.toLowerCase();
        const profilePostResults = await ProfilePosts.findAll({
            where: {
                [Op.or]: [{
                    title: {
                        [Op.iLike]: `%${keyword}`,
                    },
                }, {
                    content: {
                        [Op.iLike]: `%${keyword}`,
                    },
                }],
            },
            include: [{
                model: Users, 
                as: 'ProfilePoster',
                attributes: ['username']
            }],
        });

        const groupPostResults = await GroupPosts.findAll({
            where: {
                [Op.or]: [{
                    title: {
                        [Op.iLike]: `%${keyword}`,
                    },
                }, {
                    content: {
                        [Op.iLike]: `%${keyword}`,
                    },
                }],
            },
            include: [{
                model: Users,
                as: 'GroupPoster',
                attributes: ['username'],
            }],
        });

        res.json({
            posts: [...profilePostResults, ...groupPostResults],
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Searches profiles
router.get('/search/profiles', authenticateCheck, async (req, res) => {
    try {
        const keyword = req.query.keyword.toLowerCase();
        const profileResults = await Profiles.findAll({
            where: {
                [Op.or]: [{
                    bio: {
                        [Op.iLike]: `%${keyword}%`,
                    },
                }],
            },
            attributes: ['profile_id', 'bio', 'profile_photo'],
            include: [{
                model: ProfileChannels,
                attributes: ['channel_name'],
            }],
        });
    
        res.json(profileResults);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message }); 
    }
});

export default router;



