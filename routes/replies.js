import authenticateCheck from '../functions/authenticateCheck.js';
import { GroupReplies, GroupPosts, ProfileReplies, ProfilePosts, Profiles, ReplyVotes, Users } from '../models/models.js';
import { Router } from 'express';
import { v4 } from 'uuid';

const router = Router();

//Add reply Route
router.post('/add_reply', authenticateCheck, async (req, res) => {
    try {
        const { content, isGroup, parent_id, post_id } = req.body;
        const replier_id = req.session.user_id; 
        const post_type = isGroup ? 'group_post' : 'profile_post'; 
        const reply_id = v4();
        const ReplyModel = isGroup ? GroupReplies : ProfileReplies;
        
        await ReplyModel.create({ 
            reply_id, post_id, post_type, replier_id, content, upvotes: 0, downvotes: 0, timestamp: new Date(), parent_id 
        });

        //Depends on if post is in profile or group
        const PostModel = isGroup ? GroupPosts : ProfilePosts;
        const contentToUpdate = await PostModel.findByPk(post_id);
        contentToUpdate.comments += 1;
        await contentToUpdate.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Get Comments Route 
router.get('/get_replies/:postId', authenticateCheck, async (req, res) => {
    try {
        const isGroup = req.query.isGroup === 'true';
        const postId = req.params.postId;
        const ReplyModel = isGroup ? GroupReplies : ProfileReplies;
        const replies = await ReplyModel.findAll({
            where: { post_id: postId },
            include: [{
                model: Users,
                as: isGroup ? 'GroupReplier' : 'ProfileReplier',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }]
        });
        res.json(replies);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Allows reply to be taken down either by the user or moderators
router.delete('/remove_reply', authenticateCheck, async (req, res) => {
    try {
        const { isGroup, reply_id } = req.body;
        const postModel = isGroup ? GroupReplies : ProfileReplies;
        await postModel.destroy({ where: { reply_id } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Up or downvote a reply
router.post('/reply_vote', authenticateCheck, async (req, res) => {
    try {
        const { reply_id, isGroup, vote_type } = req.body;
        const userId = req.session.user_id;

        const [vote] = await ReplyVotes.findOrCreate({
            where: {
                reply_id: reply_id,
                user_id: userId
            },
            defaults: {
                vote_id: v4(),
            }
        });

        //Limits upvotes and downvotes on each reply to 10
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

        const ReplyModel = isGroup ? GroupReplies : ProfileReplies;

        const replyToUpdate = await ReplyModel.findByPk(reply_id);
        if (vote_type === 'upvote') {
            replyToUpdate.upvotes += 1;
        } else if (vote_type === 'downvote') {
            replyToUpdate.downvotes += 1;
        }

        await replyToUpdate.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
