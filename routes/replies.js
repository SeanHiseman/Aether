import authenticateCheck from '../functions/authenticateCheck.js';
import { GroupReplies, GroupReplyNotes, ProfileReplies, ProfileReplyNotes, Profiles, ReplyVotes, Users } from '../models/models.js';
import multer from 'multer';
import { Router } from 'express';
import { v4 } from 'uuid';

const router = Router();

const reply_storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'media/replies');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// File filter for replies (similar to posts)
const replyFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

// Upload middleware for replies
const reply_upload = multer({
    storage: reply_storage,
    limits: {
        fileSize: 1024 * 1024 * 100
    },
    fileFilter: replyFilter
});

router.post('/add_reply', authenticateCheck, reply_upload.array('files'), async (req, res) => {
    try {
        const { post_id, parent_id, content, isGroup } = req.body;
        //Convert to boolean
        const isGroupBool = isGroup === 'true';
        //Convert parentId to correct type
        const parentId = parent_id === 'null' || parent_id === '' ? null : parent_id;
        const ReplyModel = isGroupBool ? GroupReplies : ProfileReplies;
        const reply_id = v4();
        const user = await Users.findOne({ where: { username: req.session.username } });
        let formattedContent = content;

        //Add media tags to content
        req.files.forEach((file) => {
            const fileType = file.mimetype.startsWith('image') ? 'img' : 'video';
            const fileTag = fileType === 'img' ? `<img src="/media/replies/${file.filename}">` : `<video src="/media/replies/${file.filename}" controls></video>`;
            formattedContent += ' ' + fileTag;
        });

        //Create reply in database
        const reply = await ReplyModel.create({
            reply_id,
            post_id,
            parent_id: parentId,
            content: formattedContent,
            replier_id: user.user_id,
            upvotes: 0,
            downvotes: 0,
        });

        return res.json({ status: "success", message: "Reply added successfully", reply });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

router.get('/get_replies/:postId', authenticateCheck, async (req, res) => {
    try {
        const isGroup = req.query.isGroup === 'true';
        const postId = req.params.postId;
        const ReplyModel = isGroup ? GroupReplies : ProfileReplies;
        const NoteModel = isGroup ? GroupReplyNotes : ProfileReplyNotes;
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
            }, {
                model: NoteModel,
                as: 'note',
                attributes: ['note_id', 'note_content', 'timestamp', 'is_misinfo'],
                required: false
            }],
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
        const replyModel = isGroup ? GroupReplies : ProfileReplies;
        const noteModel = isGroup ? GroupReplyNotes : ProfileReplyNotes;
        await noteModel.destroy({ where: { reply_id } });
        await replyModel.destroy({ where: { reply_id } });
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
            where: { reply_id: reply_id, user_id: userId },
            defaults: { vote_id: v4(), vote_count: 0 }
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
        
        //Limits upvotes and downvotes on each reply to 10
        if (vote.vote_count >= 10 && vote_type === 'upvote') {
            return res.json({ success: false, message: 'Upvote limit' });
        } else if (vote.vote_count <= -10 && vote_type === 'downvote') {
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
