import authenticateCheck from '../functions/authenticateCheck.js';
import checkIfUserIsAdmin from '../functions/adminCheck.js';
import checkIfUserIsMember from '../functions/memberCheck.js';
import { Groups, GroupChannels, GroupChannelMessages, GroupPosts, Profiles, Users, UserGroups } from '../models/models.js';
import multer from 'multer';
import { Router } from 'express';
import path from 'path';
import { v4 } from 'uuid';
const router = Router();

//Create new channel within a group
router.post('/add_group_channel', authenticateCheck, async (req, res) => {
    try {
        const { channel_name, groupId, isPosts} = req.body;

        //Checks if group can be found
        const group = await Groups.findByPk(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found'});
        }

        const newChannel = await GroupChannels.create({ 
            channel_id: v4(),
            channel_name: channel_name,
            group_id: groupId,
            is_posts: isPosts
        });
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Update group description
router.post('/change_description', authenticateCheck, async (req, res) => {
    try {
        const { description, groupId } = req.body;
        const group = await Groups.findOne({ where: { group_id: groupId } });
        if (group) {
            group.description = description;
            await group.save();
            res.status(200).json({ message: "Description updated successfully" });
        } else {
            res.status(404).json({ message: "Group not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update description" });
    }
});

//Update group name
router.post('/change_group_name', authenticateCheck, async (req, res) => {
    try {
        const { groupName, groupId } = req.body;
        const group = await Groups.findOne({ where: { group_id: groupId } });
        if (group) {
            group.group_name = groupName;
            await group.save();
            res.status(200).json({ message: "Name updated successfully" });
        } else {
            res.status(404).json({ message: "Group not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update name" });
    }
});

//Multer setup for profile uploads
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
            group_leader: user_id
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

//const upload = multer({ dest: 'uploads/' });
//const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mkv', 'avi']);

const allowedFile = (filename) => {
    //placeholder
    return true;
    //return filename.includes('.') && ALLOWED_EXTENSIONS.has(filename.split('.').pop().toLowerCase());
}

//Multer setup for post uploads
const post_storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'media/content');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

//Upload post to group
router.post('/create_group_post', authenticateCheck, upload.array('files'), async (req, res) => {
    let { group_id, channel_id, title, content } = req.body;
    let mediaUrls = [];
    try {
        title = title || null;
        if (req.files) {
            mediaUrls = req.files.filter(file => allowedFile(file.originalname)).map(file => {
                const filepath = path.join(__dirname, 'media', file.filename);
                return filepath
            });
        }

        const post_id = v4();
        const user = await Users.findOne({ where: { username: req.session.username } });
        if (!user) {
            return res.status(404).json({ "status": "error", "message": "Could not fetch user_id" });
        }

        await GroupPosts.create({
            post_id,
            group_id,
            channel_id,
            title,
            content,
            media_urls: JSON.stringify(mediaUrls),
            poster_id: user.user_id,
        });
        return res.json({ "status": "success", "message": "Successful upload." });
    } catch (e) {
        console.error(e);
        return res.status(404).json({ "status": "error", "message": e.message });
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

//Gets details of all members of a group
router.get('/get_group_members', authenticateCheck, async (req, res) => {
    const { group_id } = req.query;
    try {
        const members = await UserGroups.findAll({
            where: { group_id: group_id },
            include: [{
                model: Users,
                required: true,
                attributes: ['user_id', 'username']
            }],
            attributes: ['is_mod', 'is_admin']
        });
        res.json(members);
    } catch (error) {
        res.status(500).json('Error getting group members:', error);
    }
});

//Group home page data route
router.get('/group/:group_name', authenticateCheck, async (req, res) => {
    const groupName = req.params.group_name;
    const userId = req.session.user_id;
    try {
        //Check if user is admin or member of group
        const isAdmin = await checkIfUserIsAdmin(userId, groupName);
        const isMember = await checkIfUserIsMember(userId, groupName);
        const group = await Groups.findOne({where: {group_name: groupName}});
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
        res.status(500).send('Error getting group.');
    }
});

//Returns messages from a chat channel
router.get('/group_channel_messages/:channel_id', authenticateCheck, async (req, res) => {
    const { channel_id } = req.params;
    try {
        const messages = await GroupChannelMessages.findAll({
            where: { channel_id },
            include: [{
                model: GroupChannels,
                attributes: ['channel_name', 'group_id'],
            }],
            //Sort chronologically
            order: [['message_time', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
});

//Posts made to a group channel
router.get('/group_channel_posts', authenticateCheck, async (req, res) => {
    try {
        const { channel_id, location_id } = req.query;
        //Limits number of posts returned
        //const limit = parseInt(req.query.limit) || 10;
        //const offset = parseInt(req.query.offset) || 0;
        const posts = await GroupPosts.findAll({
            where: {
                group_id: location_id,
                channel_id: channel_id
            },
            //limit: limit,
            //offset: offset,
            include: [{
                model: Users,
                as: 'GroupPoster',
                attributes: ['username'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo'],
                }]
            }],
            //Posts sorted chronilogically (temporary)
            order: [['timestamp', 'DESC']]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Collates content from across group in to main feed
router.get('/group_main_posts', authenticateCheck, async (req, res) => {
    try {
        const { location_id } = req.query;
        const posts = await GroupPosts.findAll({
            where: {
                group_id: location_id
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
        })
        res.json(posts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).send('Error getting groups.');
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

//Allows user to leave/be removed from group
router.post('/leave_group', authenticateCheck, async (req, res) => {
    const { userId, groupId } = req.body;
    try {
        await UserGroups.destroy({
            where: { user_id: userId, group_id: groupId }
        });
        //Lower member count
        const group = await Groups.findByPk(groupId);
        await group.decrement('member_count');
    } catch (error) {
        res.status(500).json(error.message);
    }
});

//Changes if a user is a moderator
router.post('/toggle_moderator', authenticateCheck, async (req, res) => {
    const { groupId, userId, isMod } = req.body;
    try {
        await UserGroups.update(
            { is_mod: isMod },
            { where: { group_id: groupId, user_id: userId } }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed to update moderator status.' });
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

export const groupChatChannelSocket = (socket) => {
    socket.on('join_channel', (channelId) => {
        socket.join(channelId);
    });

    socket.on('send_group_message', async (message) => {
        const messageLength = message.content.length;
        if (messageLength === 0) {
            socket.emit('error_message', { error: "Message too short" });
            return;
        } else if (messageLength > 1000) {
            socket.emit('error_message', { error: "Message too long" });
            return;
        }

        const newMessage = await GroupChannelMessages.create({
            message_id: v4(),
            group_id: message.groupId,
            channel_id: message.channelId,
            message_content: message.content,
            message_time: new Date(),
            sender_id: message.senderId,
        });
        socket.to(message.channelId).emit('new_message', newMessage);
    });

    socket.on('leave_channel', (channelId) => {
        socket.leave(channelId);
    })
};

export default router;
