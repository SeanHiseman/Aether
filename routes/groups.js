import authenticateCheck from '../functions/authenticateCheck.js';
import checkIfUserIsAdminOrMod from '../functions/adminModCheck.js';
import checkIfUserIsMember from '../functions/memberCheck.js';
import { Groups, GroupChannels, GroupChannelMessages, GroupRequests, GroupPosts, NestedGroupMembers, NestedGroupRequests, Profiles, Users, UserGroups } from '../models/models.js';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { join } from 'path';
import { Router } from 'express';
import path from 'path';
import { v4 } from 'uuid';

const app = express();
const router = Router();
const __dirname = path.dirname(import.meta.url);
app.use(express.static(join(__dirname, 'static')));

//Multer setup for profile uploads
const group_photo_storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'media/group_profiles');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
//Check file input for group photo
const profileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
}
//Uploads with file size limit
const profile_upload = multer({
    storage: group_photo_storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: profileFilter
}).single('new_group_profile_photo');

//Adds user to private group
router.post('/accept_join_request', authenticateCheck, async (req, res) => {
    try {
        const { groupId, requestId, senderId } = req.body;
        await UserGroups.create({
            user_id: senderId,
            group_id: groupId
        });
        await Groups.increment('member_count', { where: { group_id: groupId } });
        await GroupRequests.destroy({
            where: { request_id: requestId }
        });
        res.status(200).json({ message: 'User added to group'});
    } catch (error) {
        res.status.json({ error: error.message });
    }
});

//Adds sub group to parent group
router.post('/accept_nest_request', authenticateCheck, async (req, res) => {
    try {
        const { groupId, requestId, senderId } = req.body;
        await NestedGroupMembers.create({
            sub_group_id: senderId,
            parent_group_id: groupId
        });
        await Groups.update({
            parent_id: groupId
        });
        await NestedGroupRequests.destroy({
            where: { request_id: requestId }
        });
        res.status(200).json({ message: 'User added to group'});
    } catch (error) {
        res.status.json({ error: error.message });
    }
});

//Create new channel within a group
router.post('/add_group_channel', authenticateCheck, async (req, res) => {
    try {
        let { channel_name, groupId, isPosts, isChat } = req.body;
        //If channel types are not specified
        if (isPosts === false && isChat === false) {
            isPosts = true;
            isChat = true;
        };
        const newChannel = await GroupChannels.create({ 
            channel_id: v4(),
            channel_name: channel_name,
            group_id: groupId,
            is_posts: isPosts,
            is_chat: isChat
        });
        res.status(201).json(newChannel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Cancel private group feed follow request
router.delete('/cancel_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { userId, groupId } = req.body;
        await GroupRequests.destroy({
            where: { sender_id: userId, group_id: groupId } 
        });
        res.status(200).json("Join request rejected");
    } catch (error) {
        res.status(500).json(error.message);
    }
});

//Update group description
router.post('/change_description', authenticateCheck, async (req, res) => {
    try {
        const { description, groupId } = req.body;
        const group = await Groups.findOne({ where: { group_id: groupId } });
        group.description = description;
        await group.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Update group name
router.post('/change_group_name', authenticateCheck, async (req, res) => {
    try {
        const { groupName, groupId } = req.body;
        const group = await Groups.findOne({ where: { group_id: groupId } });
        group.group_name = groupName;
        await group.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Create a new group feed
router.post('/create_group', authenticateCheck, (req, res) => {
    profile_upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            //A Multer error occurred when uploading
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 5MB' });
            }
            return res.status(400).json({ error: 'Error uploading file' });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        try {
            const { group_name, is_private, group_id, user_id } = req.body;
            //Prevents duplicate group names
            const existingGroup = await Groups.findOne({ where: { group_name: group_name } });
            if (existingGroup) {
                return res.status(400).json({ error: 'Name taken' });
            }
            let group_photo = "media/site_images/blank-group-icon.jpg";
            if (req.file) {
                group_photo = req.file.path;
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
            res.status(500).json({ success: false });
        }
    });
});

//Deletes group (only available to group leaders)
router.delete('/delete_group', authenticateCheck, async (req, res) => {
    try {
        const { group_id } = req.body;
        //await GroupReplies.destroy({
            //where: { group_id },
        //});
        await GroupPosts.destroy({
            where: { group_id },
        });
        await GroupRequests.destroy({
            where: { group_id },
        });
        await UserGroups.destroy({
            where: { group_id },
        });
        await GroupChannels.destroy({
            where: { group_id },
        });
        await GroupChannelMessages.destroy({
            where: { group_id },
        });
        await Groups.destroy({
            where: { group_id },
        });
        res.status(200).json({ success: true});
    } catch (error) {
        res.status(500).json({ error: 'Error deleting group' });
    }
});

//Deletes channel 
router.delete('/delete_group_channel', authenticateCheck, async (req, res) => {
    try {
        const { channel_name, group_id } = req.body;
        //Main channels are default, so can't be deleted
        if (channel_name === 'Main') {
            res.status(500).json({ message: 'Main channels cannot be deleted' });
        } else {
            await GroupChannels.destroy({
                where: { 
                    channel_name,
                    group_id
                },
            });
            res.status(200).json({ message: 'Channel deleted successfully '});
        }
    } catch (error) {
        res.status(500).json({ error: 'Error deleting channel' });
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
            }],
            order: [['date_created', 'ASC']]
        });
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//Allows users to join a group
router.post('/follow_group', authenticateCheck, async (req, res) => {
    try{
        const { userId, groupId } = req.body;
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
        res.status(500).json({error: 'Error getting group members' });
    }
});

//Group home page data route
router.get('/group/:group_name', authenticateCheck, async (req, res) => {
    try {
        const groupName = req.params.group_name;
        const userId = req.session.user_id;

        //Check if user is admin, moderator or member of group
        const { isAdmin, isMod } = await checkIfUserIsAdminOrMod(userId, groupName);
        const isMember = await checkIfUserIsMember(userId, groupName);
        const group = await Groups.findOne({where: {group_name: groupName}});
        const groupData = group.toJSON(); 
        groupData.isAdmin = isAdmin;
        groupData.isMod = isMod;
        groupData.isLeader = (userId === group.group_leader);
        groupData.isMember = isMember;
        groupData.userId = userId;
        //Finds user join request if private group
        if (group.is_private) {
            const hasJoinRequest = await GroupRequests.findOne({
                where: {
                    sender_id: userId,
                },
            });

            groupData.isRequestSent = !!hasJoinRequest;
        } else {
            groupData.isRequestSent = false;
        }

        res.json(groupData);
    } catch (error) {
        res.status(500).send('Error getting group.');
    }
});

//Returns messages from a chat channel
router.get('/group_channel_messages/:channel_id', authenticateCheck, async (req, res) => {
    try {
        const { channel_id } = req.params;
        const messages = await GroupChannelMessages.findAll({
            where: { channel_id },
            include: [{
                model: GroupChannels,
                attributes: ['channel_name', 'group_id'],
            }, {
                model: Users,
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }],
            //Sort chronologically
            order: [['timestamp', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
});

//Private group join requests
router.get('/group_requests/:groupId', authenticateCheck, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const requests = await GroupRequests.findAll({ 
            where: { group_id: groupId },
            include: [{
                model: Users, 
                as: 'sender',
                required: true,
                attributes: ['user_id', 'username']
            }],
        }); 
        res.json(requests);
    } catch (error) {
        res.status(500).json(error.message);
    }
});

//Rejects request to join private group 
router.delete('/reject_group_request', authenticateCheck, async (req, res) => {
    try {
        const { requestId } = req.body;
        await GroupRequests.destroy({
            where: { request_id: requestId }
        });
        res.status(200).json({ success: true, message: 'Request rejected.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Rejects sub group request to join parent group
router.delete('/reject_nest_request', authenticateCheck, async (req, res) => {
    try {
        const { requestId } = req.body;
        await NestedGroupRequests.destroy({
            where: { request_id: requestId }
        });
        res.status(200).json({ success: true, message: 'Request rejected.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//Send user private feed follow request
router.post('/send_follow_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverId, senderId } = req.body;
        await GroupRequests.create({
            request_id: v4(),
            sender_id: senderId,
            group_id: receiverId,
        });
        res.json({ message: "Join request sent" });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

//Send request for one group to join another
router.post('/send_nest_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverName, senderId } = req.body;
        const receiverGroup = await Groups.findOne({ where: { group_name: receiverName }});
        await NestedGroupRequests.create({
            request_id: v4(),
            sender_id: senderId,
            parent_group_id: receiverGroup.group_id,
        });
        res.json({ message: "Join request sent" });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json(error.message);
    }
});

//Gets sub groups for a parent group
router.get('/sub_groups/:group_id', authenticateCheck, async (req, res) => {
    try {
        const { group_id } = req.params; //parent group_id
        const subGroups = await NestedGroupMembers.findAll({ 
            where: { parent_group_id: group_id }, 
            include: [{
                model: Groups,
                as: 'SubGroup',
                attributes: ['group_name', 'group_photo']
            }],
            //Returns grous alphabetically
            order: [[{ model: Groups, as: 'SubGroup' }, 'group_name', 'ASC']]
        });

        res.json(subGroups);
    } catch (error) {
        console.error("sub group error:", error);
        res.status(500).json(error.message);  
    }   
});

//Changes if a user is a moderator
router.post('/toggle_moderator', authenticateCheck, async (req, res) => {
    try {
        const { groupId, userId, isMod } = req.body;
        
        await UserGroups.update(
            { is_mod: isMod },
            { where: { group_id: groupId, user_id: userId } }
        );
    } catch (error) {
        res.status(500).json({ error: 'Failed to update moderator status.' });
    }
});

router.put('/update_group_photo/:groupId', authenticateCheck, async (req, res) => {
    profile_upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            //A Multer error occurred when uploading
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File cannot be more than 5MB' });
            }
            return res.status(400).json({ success: false });
        } else if (err) {
            return res.status(400).json({ success: false });
        }
        try {
            const defaultGroupPhotoPath = 'media/site_images/blank-group-icon.jpg';
            const groupId = req.params.groupId; 
            const file = req.file; 
            const filename = file.filename;
            const newPhotoPath = `media/group_profiles/${filename}`;
            const group = await Groups.findOne({ where: { group_id: groupId } });
            //Deletes old photo
            if (group.group_photo && group.group_photo !== defaultGroupPhotoPath) {
                const currentPhotoPath = path.join(group.group_photo);
                fs.unlink(currentPhotoPath, (error) => {
                    if (error) {
                        console.error(`Error deleting old photo: ${error}`);
                    }
                });
            }
            group.group_photo = newPhotoPath;
            await group.save();
            return res.json({ newPhotoPath: newPhotoPath });
        } catch (error) {
            res.status(500).json({ success: false });
        };
    });
});

router.post('/unfollow_group', authenticateCheck, async (req, res) => {
    try {
        const { userId, groupId } = req.body;
        await UserGroups.destroy({
            where: { user_id: userId, group_id: groupId }
        });
        //Lower member count
        const group = await Groups.findByPk(groupId);
        await group.decrement('member_count');
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

export const groupChatChannelSocket = (socket) => {
    try {
        socket.on('join_channel', (channelId) => {
            socket.join(channelId);
        });

        socket.on('delete_message', async (data) => {
            const { message_id, channel_id } = data;
            await GroupChannelMessages.destroy({ where: { message_id } });
            socket.to(channel_id).emit('delete_message', { message_id });
        });

        socket.on('send_group_message', async (message) => {
            const messageLength = message.message_content.length;
            if (messageLength === 0) {
                socket.emit('error_message', { error: "Message too short" });
                return;
            } else if (messageLength > 1000) {
                socket.emit('error_message', { error: "Message too long" });
                return;
            }
    
            const newMessage = await GroupChannelMessages.create({
                message_id: message.message_id,
                group_id: message.groupId,
                channel_id: message.channelId,
                message_content: message.message_content,
                sender_id: message.sender_id,
                timestamp: message.timestamp,
            });
            socket.to(message.channelId).emit('new_message', newMessage);
        });
    
        socket.on('leave_channel', (channelId) => {
            socket.leave(channelId);
        }) 
    } catch (error) {
        console.log("Socket error:", error);
    }
};

export default router;
