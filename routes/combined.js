//Routes that combine profiles and groups
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import { v4 } from 'uuid';
import { ContentVotes, Groups, GroupNotes, GroupReplies, GroupPosts, ProfileNotes, ProfileReplies, ProfilePosts, Profiles, Users } from '../models/models.js'; 

const router = Router();

//Posts from group or profile channels
router.get('/channel_posts', authenticateCheck, async (req, res) => {
    try {
        const { isGroup, location_id, channel_id } = req.query;
        const isGroupBool = isGroup === 'true'; //Convert from string to boolean
        const userId = req.session.user_id;
        let PostModel, UserAlias, VotesAlias, NotesModel, whereChannel;
        PostModel = isGroupBool ? GroupPosts : ProfilePosts;
        UserAlias = isGroupBool ? 'GroupPoster' : 'ProfilePoster';
        VotesAlias = isGroupBool ? 'GroupPostVotes' : 'ProfilePostVotes';
        NotesModel = isGroupBool ? GroupNotes : ProfileNotes;
        whereChannel = {
            [isGroupBool ? 'group_id' : 'profile_id']: location_id,
            ...(channel_id ? { channel_id: channel_id } : {})
        };
        const posts = await PostModel.findAll({
            where: whereChannel,
            include: [{
                model: Users,
                as: UserAlias,
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }, {
                model: ContentVotes,
                as: VotesAlias,
                attributes: ['vote_count'],
                required: false
            }, {
                model: NotesModel,
                as: 'note',
                attributes: ['note_id', 'note_content', 'timestamp', 'is_misinfo'],
                required: false
            }],
            attributes: ['post_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp', 'poster_id', 'points'],
        });
        const finalResults = posts.map((post) => ({
            ...post.dataValues,
            is_group: isGroupBool
        }));
        //const sortedPosts = post_type === 'group' 
            //? sortPostsByWeightedRatio(finalResults, userId)
            //: finalResults.sort((a, b) => b.timestamp - a.timestamp);
        res.json(finalResults);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Checks input for post uploads
const postFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

//Multer setup for post uploads
const post_storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'media/content');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

//Uploads with file size limit
const post_upload = multer({
    storage: post_storage,
    limits: {
        fileSize: 1024 * 1024 * 100 // 100 MB limit
    },
    fileFilter: postFilter
});

//Uploads posts to either profile or group post tables
router.post('/create_post', authenticateCheck, post_upload.array('files'), async (req, res) => {
    try {
        const { profile_id, group_id, channel_id, title, content } = req.body;
        const post_id = v4();
        const user = await Users.findOne({ where: { username: req.session.username } });
        let formattedContent = content;
        //Process uploaded files and format content
        req.files.forEach((file) => {
            const fileType = file.mimetype.startsWith('image') ? 'img' : 'video';
            const fileTag = fileType === 'img' ? `<img src="/media/content/${file.filename}">` : `<video src="/media/content/${file.filename}" controls></video>`;
            formattedContent += ' ' + fileTag;
        });
        //Determine the post model and dynamic fields
        let postModel, postData = { 
            post_id, 
            channel_id, 
            title, 
            content: formattedContent, 
            poster_id: user.user_id 
        };
        if (profile_id) {
            postModel = ProfilePosts;
            postData.profile_id = profile_id;  
        } else if (group_id) {
            postModel = GroupPosts;
            postData.group_id = group_id;  
        } else {
            return res.status(500).json({ success: false });
        }
        const post = await postModel.create(postData);
        return res.json({ success: true, post });
    } catch (error) {
        return res.status(500).json({ success: false });
    }
});

//Allows post to be taken down either by the user or moderators
router.delete('/remove_post', authenticateCheck, async (req, res) => {
    try {
        const { postData } = req.body;
        const { isGroup, postId } = postData;
        const RepliesModel = isGroup ? GroupReplies : ProfileReplies;
        const NotesModel = isGroup ? GroupNotes : ProfileNotes;
        const PostModel = isGroup ? GroupPosts : ProfilePosts;  
        const post = await PostModel.findOne({
            where: { post_id: postId }
        });
        deleteMedia(post.content);
        await RepliesModel.destroy({ where: { post_id: postId } });
        await NotesModel.destroy({ where: { post_id: postId } })
        await PostModel.destroy({ where: { post_id: postId } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Fetches post on its own (could combine with /channel_posts to avoid repetition)
router.get('/single_post', authenticateCheck, async (req, res) => {
    try {
        const { isGroup, postId } = req.query;
        const isGroupBool = isGroup === 'true'; //Convert from string to boolean
        let PostModel, UserAlias, VotesAlias, NotesModel, whereChannel;
        PostModel = isGroupBool ? GroupPosts : ProfilePosts;
        UserAlias = isGroupBool ? 'GroupPoster' : 'ProfilePoster';
        VotesAlias = isGroupBool ? 'GroupPostVotes' : 'ProfilePostVotes';
        NotesModel = isGroupBool ? GroupNotes : ProfileNotes;
        const post = await PostModel.findOne({
            where: { post_id: postId },
            include: [{
                model: Users,
                as: UserAlias,
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }, {
                model: ContentVotes,
                as: VotesAlias,
                attributes: ['vote_count'],
                required: false
            }, {
                model: NotesModel,
                as: 'note',
                attributes: ['note_id', 'note_content', 'timestamp', 'is_misinfo'],
                required: false
            }],
            attributes: ['post_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp', 'poster_id', 'points'],
        });
        res.status(200).json({ success: true, post });
    } catch {
        res.status(500).json({ success: false }); 
    }
});

//Toggles privacy status of either a group or a profile
router.post('/toggle_private', authenticateCheck, async (req, res) => {
    try {
        const { locationId, isGroup } = req.body;
        let location;
        if (isGroup) {
            location = await Groups.findOne({ where: { group_id: locationId } });
        } else {
            location = await Profiles.findOne({ where: { profile_id: locationId } });
        }
        const updatedLocation = await location.update({
            is_private: !location.is_private,
        });
        res.status(200).json(updatedLocation);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

export default router;