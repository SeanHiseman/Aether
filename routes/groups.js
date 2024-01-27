import checkIfUserIsAdmin from '../functions/adminCheck.js';
import { Groups, Channels } from '../models/models.js';
import { Router } from 'express';
import authenticateCheck from '../functions/authenticateCheck.js';
const router = Router();

//Group home page route
router.get('/group/:group_id', authenticateCheck, async (req, res) => {
    const groupId = req.params.group_id;
    const userId = req.session.user_id;
    
    //Check if user is admin of group
    const isAdmin = await checkIfUserIsAdmin(userId, groupId);

    //Choose template based on if user is admin
    const groupTemplate = isAdmin ? 'GroupHomeAdmin' : 'GroupHome';
    
    res.render('base', {
        content: 'groups/${groupTemplate}',
        user_id: userId,
    });
});

//Create a new group
router.post('/create_group', authenticateCheck, async (req, res) => {
    try {
        const { group_name, parent_id, is_private, user_id } = req.body;
        const group_photo = req.body.new_group_profile_photo || "../static/images/site_images/blank-group-icon.jpg";
        const newGroup = await Groups.create({ 
            parent_id,
            group_name, 
            group_photo,
            member_count: 1,
            is_private: is_private === 'on',
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
