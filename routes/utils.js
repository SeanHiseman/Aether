import { Router } from 'express';
import multer from 'multer';
import { join, extname } from 'path';
import { renameSync, statSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Posts, Users } from '../models/models.js'; 

const router = Router();

const upload = multer({ dest: 'uploads/' });

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mkv', 'avi']);

function allowedFile(filename) {
    return filename.includes('.') && ALLOWED_EXTENSIONS.has(filename.split('.').pop().toLowerCase());
}

router.post('/post_upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title;

        if (!title) {
            return res.status(400).json({ "status": "error", "message": "Title cannot be empty" });
        }

        if (file && allowedFile(file.originalname)) {
            const id = uuidv4();
            const filename = file.originalname;
            const filepath = join(req.app.get('CONTENT_UPLOAD_FOLDER'), filename);
            renameSync(file.path, filepath);

            const fileStats = statSync(filepath);
            const file_size = fileStats.size / 1024; // size in KB
            const content_type = ['jpg', 'jpeg', 'png', 'gif'].includes(extname(filepath).toLowerCase().substring(1)) ? 'image' : 'video';
            let duration = null;

            if (content_type === 'video') {
                //VIDEO EXTRACTION DATA EDIT ME
            }

            const user = await Users.findOne({ where: { username: req.session.username } });
            if (!user) {
                return res.status(404).json({ "status": "error", "message": "Could not fetch user_id" });
            }

            const timestamp = new Date().toISOString();
            await Posts.create({
                post_id: id,
                title: title,
                path: `content/${filename}`,
                content_type: content_type,
                duration: duration,
                size: file_size,
                userId: user.user_id,
                timestamp: timestamp,
            });

            return res.json({ "status": "success", "message": "File successfully uploaded." });
        } else {
            return res.status(400).json({ "status": "error", "message": "File not allowed." });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({ "status": "error", "message": e.message });
    }
});

router.post('/:action/:contentId', async (req, res) => {
    const { action, contentId } = req.params;
    const content = await Posts.findByPk(contentId);
    if (content) {
        if (action === 'like') {
            content.likes += 1;
        } else if (action === 'dislike') {
            content.dislikes += 1;
        }
        await content.save();
        return res.json({ success: true });
    }
    return res.status(404).json({ success: false });
});

router.get('/get_current_user', (req, res) => {
    const userId = req.session.user_id;
    if (userId) {
        return res.json({ user_id: userId });
    }
    return res.status(401).json({ "error": "No user logged in" });
});

export default router;
