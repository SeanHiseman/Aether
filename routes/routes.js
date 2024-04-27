import { Router } from 'express';
import { ContentVotes, Followers, Friends, FriendRequests, Groups, GroupRequests, GroupPosts, ProfilePosts, Profiles, Users, UserGroups } from '../models/models.js'; 
import authenticateCheck from '../functions/authenticateCheck.js';
import checkIfUserIsMember from '../functions/memberCheck.js';
import { Op } from 'sequelize';
import sortPostsByWeightedRatio from '../functions/postSorting.js';
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

        if (vote_type === 'check_vote') {
            if (vote.vote_count >= 10) {
                return res.json({ success: true, message: 'upvote limit' });
            } else if (vote.vote_count <= -10) {
                return res.json({ success: true, message: 'downvote limit' });
            } else {
                return res.json({ success: true, message: 'no limit' });
            }
        }

        if (vote.vote_count >= 10 && vote_type === 'upvote') {
            return res.json({ success: false, message: 'upvote limit'});
        } else if (vote.vote_count <= -10 && vote_type === 'downvote') {
            return res.json({ success: false, message: 'downvote limit '});
        }


        //Limits upvotes and downvotes on each post to 10
        if (vote_type === 'upvote') {
            vote.vote_count += 1;
        } else if (vote_type === 'downvote') {
            vote.vote_count -= 1;
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

        //Applies weighting algorithm to posts
        const sortedPosts = sortPostsByWeightedRatio(posts);
        res.json(sortedPosts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
});

//Profiles and groups followed/joined by user
router.get('/following_posts', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;

        //Fetch followed profiles
        const followedProfiles = await Followers.findAll({
            where: { follower_id: userId },
            include: [{
                    model: Profiles,
                    attributes: ['profile_id'],
                }],
            attributes: [],
        });

        //Fetch user groups
        const userGroups = await UserGroups.findAll({
            where: { user_id: userId },
            include: [{
                    model: Groups,
                    attributes: ['group_id'],
                }],
            attributes: [],
        });

        //Get profile IDs and group IDs
        const profileIds = followedProfiles.map((follower) => follower.profile.profile_id);
        const groupIds = userGroups.map((userGroup) => userGroup.group.group_id);

        //Fetch posts from followed profiles
        const profilePosts = await ProfilePosts.findAll({
            where: { profile_id: { [Op.in]: profileIds } },
            include: [{
                model: Users,
                as: 'ProfilePoster',
                attributes: ['username'],
                include: [{
                        model: Profiles,
                        attributes: ['profile_photo'],
                    }],
                }],
            order: [['timestamp', 'DESC']],
        });

        //Fetch posts from user groups
        const groupPosts = await GroupPosts.findAll({
            where: { group_id: { [Op.in]: groupIds } },
            include: [{
                model: Users,
                as: 'GroupPoster',
                attributes: ['username'],
                include: [{
                        model: Profiles,
                        attributes: ['profile_photo'],
                    }],
                }],
            order: [['timestamp', 'DESC']],
        });

        //Combine posts from profiles and groups
        const posts = [...profilePosts, ...groupPosts];

        //Applies weighting algorithm to posts
        const sortedPosts = sortPostsByWeightedRatio(posts);
        res.json(sortedPosts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/get_current_user', authenticateCheck, (req, res) => {
    try{ 
        const userId = req.session.user_id;
        if (userId) {
            res.json({ user_id: userId });
        }    
    } catch (error) {
        res.status(401).json({ "error": "No user logged in" });
    }
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
        const { postData } = req.body;
        const { isGroup, postId } = postData;
        const postModel = isGroup ? GroupPosts : ProfilePosts;
        await postModel.destroy({ where: { post_id: postId }});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Searches groups
router.get('/search/groups', authenticateCheck, async (req, res) => {
    try {
        const user_id = req.session.user_id;
        const keyword = req.query.keyword.toLowerCase();

        //Sees if a user has sent a join request to a private group
        const user = await Users.findOne({
            where: { user_id },
            include: [{
                model: GroupRequests,
                as: 'sent_group_requests',
                attributes: ['group_id'],
                required: false,
            }]
        });

        const groups = await Groups.findAll({
            where: { group_name: { [Op.like]: `%${keyword}%` } },
            attributes: ['group_id', 'group_name', 'description', 'group_photo', 'member_count', 'is_private'],
        });

        const groupData = await Promise.all(groups.map(async (group) => {
            const isMember = await checkIfUserIsMember(user_id, group.group_name);
            const isRequestSent = group.is_private && user.sent_group_requests.some((request) => request.group_id === group.group_id);
            return {
                ...group.toJSON(),
                userId: user_id,
                isMember: isMember,
                isRequestSent
            };
        }));

        res.json(groupData);
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
                    title: {[Op.like]: `%${keyword}%`},
                }, {content: {[Op.like]: `%${keyword}%`,}}
            ]},
            include: [{
                model: Users, 
                as: 'ProfilePoster',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo'],
                }]
            }],
        });

        const groupPostResults = await GroupPosts.findAll({
            where: {
                [Op.or]: [{
                    title: {[Op.like]: `%${keyword}%`,},
                }, {
                    content: {[Op.like]: `%${keyword}%`,},
                }],
            },
            include: [{
                model: Users,
                as: 'GroupPoster',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo'],
                }]
            }],
        });
        //Adds group true/false to posts
        const finalProfileResults = profilePostResults.map((post) => {
            return { ...post.dataValues, is_group: false };
        });
        const finalGroupResults = groupPostResults.map((post) => {
            return { ...post.dataValues, is_group: true };
        });
        const posts = [...finalProfileResults, ...finalGroupResults]

        //Applies weighting algorithm to posts
        const sortedPosts = sortPostsByWeightedRatio(posts);
        console.log("sortedPosts:", sortedPosts);
        res.json(sortedPosts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Searches profiles
router.get('/search/profiles', authenticateCheck, async (req, res) => {
    try {
        const loggedInUserId = req.session.user_id; 
        const keyword = req.query.keyword.toLowerCase(); 

        // Fetch profiles based on search keyword
        const profiles = await Profiles.findAll({
        where: {
            [Op.or]: [
                { '$user.username$': { [Op.like]: `%${keyword}%` } },
            ],
        },
        attributes: ['profile_id', 'bio', 'profile_photo', 'follower_count', 'is_private'],
        include: [{
                model: Users,
                attributes: ['username', 'user_id'], 
            }],
        });

        //Check friendship for each profile
        const formattedProfileData = await Promise.all(profiles.map(async (profile) => {
            const viewedUserId = profile.user.user_id;
            const friendship = await Friends.findOne({
                where: {
                    [Op.or]: [
                        { user1_id: loggedInUserId, user2_id: viewedUserId },
                        { user1_id: viewedUserId, user2_id: loggedInUserId },
                    ],
                },
            });

            const isFollowing = await Followers.findOne({
                where: { follower_id: loggedInUserId, profile_id: profile.profile_id },
            });

            const isFriend = !!friendship; 
            const isRequestSent = profile.is_private && (await FriendRequests.findOne({
                where: { sender_id: loggedInUserId, receiver_id: viewedUserId },
            }));

            return {
                ...profile.toJSON(),
                isFollowing: !!isFollowing,
                isFriend,
                isRequestSent: !!isRequestSent, 
            };
        }));
        res.json(formattedProfileData);
    } catch (error) {
        console.error("Error during profile search:", error);
        res.status(500).json({ success: false, message: "An error occurred during profile search." });
    }
});

export default router;



