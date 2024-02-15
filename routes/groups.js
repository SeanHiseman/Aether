import checkIfUserIsAdmin from '../functions/adminCheck.js';
import checkIfUserIsMember from '../functions/memberCheck.js';
import fs from 'fs';
import { Groups, GroupChannels, Users, UserGroups } from '../models/models.js';
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
        //Check if user is admin or member of group
        const isAdmin = await checkIfUserIsAdmin(userId, groupName);
        const isMember = await checkIfUserIsMember(userId, groupName);
        const group = await Groups.findOne({where: {group_name: groupName}});
        if (!group) {
            return res.status(404).send('Group not found');
        }
        res.json({
            isAdmin: isAdmin,
            isMember: isMember,
            groupId: group.group_id,
            groupName: group.group_name,
            description: group.description,
            groupPhoto: group.group_photo,
            memberCount: group.member_count,
            userId: userId
        });
    } catch (error) {
        res.status(500).send('Internal server error');
    }
});

//Get all groups that a user is a part of
router.get('/groups_list/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const groups = await Groups.findAll({
            include: [{
                model: Users,
                where: { user_id: userId },
                attributes: [],
            }],
            //Returns groups alphabetically
            order: [['group_name', 'ASC']]
        });
        res.json(groups);
    } catch (error) {
        res.status(500).send('Server error');
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
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
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

        let group_photo = "media/site_images/blank-group-icon.jpg";
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
        await GroupChannels.create({
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

//Update group photo
router.post('/update_group_photo/:groupId', authenticateCheck, upload.single('new_group_photo'), async (req, res) => {
    const groupId = req.params.group; 
    const file = req.file; 

    if (!file) {
        return res.status(400).json({ message: "Invalid file type. Please upload jpeg or png"});
    }

    const filename = file.filename;
    const newPhotoPath = `media/group_profiles/${filename}`;

    try {
        const group = await Groups.findOne({ where: { group_id: groupId } });
        if (group) {
            group.group_photo = newPhotoPath;
            //Deletes old photo
            //if (group.group_photo) {
                //const currentPhotoPath = path.join(__dirname, '..', group.group_photo);
                //fs.unlink(currentPhotoPath, (err) => {
                    //res.status(404).json({ message: "Error deleting old photo", err });
                //});
            //}
            await group.save();
            return res.redirect(`/group/${groupId}`);
        } else {
            res.status(404).json({ message: "Group not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "An error occured while updating the group photo"});
    }
});

//Create new channel within a group
router.post('/add_group_channel', authenticateCheck, async (req, res) => {
    try {
        const { groupId } = req.body;
        const { channel_name } = req.body;

        //Checks if group can be found
        const group = await Groups.findByPk(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found'});
        }

        const newChannel = await GroupChannels.create({ 
            channel_id: v4(),
            channel_name, 
            group_id: groupId
        });
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Get channels from a group
router.get('/get_group_channels/:groupId', authenticateCheck, async (req, res) => {
    try {
        const groupId = req.params.groupId; 
        const channels = await GroupChannels.findAll({
            include: [{
                model: Groups,
                where: { group_id: groupId },
                attributes: [],
            }]
        });
        res.json(channels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

//Allows users to join a group
router.post('/join_group', authenticateCheck, async (req, res) => {
    const { userId, groupId } = req.body;
    try{
        await UserGroups.create({
            user_id: userId,
            group_id: groupId,
            is_mod: false,
            is_admin: false
        });

        //Increase group member count
        const group = await Groups.findByPk(groupId);
        await group.increment('member_count');

        res.status(200).json();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//Allows user to leave group
router.post('/leave_group', authenticateCheck, async (req, res) => {
    const { userId, groupId } = req.body;
    try {
        await UserGroups.destroy({
            where: { user_id: userId, group_id: groupId }
        });
        //Lower member count
        const group = await Groups.findByPk(groupId);
        await group.decrement('member_count');
        res.status(200).send("Group left successfully")
    } catch (error) {
        res.status(500).send(error.message);
    }
});

export default router;
