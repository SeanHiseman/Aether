import checkIfUserIsAdmin from '../functions/adminCheck.js';
import { Groups, Channels } from '../models/models.js';
import multer from 'multer';
import { Router } from 'express';
import path from 'path';
import { v4 } from 'uuid';
import authenticateCheck from '../functions/authenticateCheck.js';
const router = Router();

//Group home page data route
router.get('/group/:group_name', authenticateCheck, async (req, res) => {
    const groupName = req.params.group_name;
    const userId = req.session.user_id;
    try {
        //Check if user is admin of group
        const isAdmin = await checkIfUserIsAdmin(userId, groupName);
        const group = await Groups.findOne({where: {group_name: groupName}});
        if (!group) {
            return res.status(404).send('Group not found');
        }
        res.json({
            isAdmin: isAdmin,
            groupName: group.group_name,
            description: group.description,
            groupPhoto: group.group_photo,
            memberCount: group.member_count
        });
    } catch (error) {
        res.status(500).send('Internal server error');
    }
});

//Multer setup for file uploads
const group_profile_photo_storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'media/group_profiles');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
//Check file input
const fileFilter = (req, file, cb) => {
    if (file.mimetype.toLowerCase() === 'image/jpeg' || file.mimetype.toLowerCase() === 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}
//Uploads with file size limit
const upload = multer({
    storage: group_profile_photo_storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: fileFilter
});

//Create a new group
router.post('/create_group', authenticateCheck, upload.single('new_group_profile_photo'), async (req, res) => {
    try {
        const { group_name, is_private, group_id, user_id } = req.body;
        
        //Prevents duplicate group names
        const existingGroup = await Groups.findOne({ where: { group_name: group_name } });
        if (existingGroup) {
            return res.status(400).json({ error: 'A group with this name already exists.'});
        }

        let group_photo = "images/site_images/blank-group-icon.jpg";
        if (req.file) {
            group_photo = req.file.path
        }

        const newGroup = await Groups.create({ 
            group_id,
            group_name, 
            group_photo,
            member_count: 1,
            is_private: is_private,
        });

        //Adds main channel
        await Channels.create({
            channel_id: v4(),
            channel_name: 'Main',
            group_id: newGroup.group_id,
        });

        //Add creating user to the group, giving them permissions
        await UserGroups.create({
            user_id: user_id,
            group_id: newGroup.group_id,
            is_mod: true,
            is_admin: true, 
        });

        res.status(201).json(newGroup);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Create new channel within a group
router.post('/add_channel', authenticateCheck, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { channel_name } = req.body;

        //Checks if group can be found
        const group = await Groups.findByPk(groupId);
        if (!group) {
            return res.status(404).jso({ error: 'Group not found'});
        }

        const newChannel = await Channels.create({ channel_name, group_id: groupId});
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Allows users to join a group
router.post('/join_group', authenticateCheck, async (req, res) => {
    try{
        const { group_id } = req.body;
        const user_id = req.session.userId;

        await UserGroups.create({
            user_id: user_id,
            group_id: group_id
            //not admin and mod default anyway
        });

        //Increment group member count
        const group = await Groups.findByPk(group_id);
        await group.increment('member_count');

        res.status(200).json();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
