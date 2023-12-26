import { Groups, Channels } from '../public/models.js';
import { Router } from 'express';
import profileData from '../public/profileData.js'; 
const router = Router();

//Group home page route
router.get('/group', async (req, res) => {
    //Check if the user is logged in
    if (!req.session.user_id) {
        return res.redirect('/login'); 
    }

    const profile_data = await profileData(req, ['profile_id', 'profile_photo']);
    //Gets profile data for logged in user
    if (profile_data) {
        const [logged_in_profile_id, logged_in_profile_photo] = profile_data;
        res.render('base', {
            content: 'groups/groupHome',
            user_id: req.session.user_id,
            logged_in_username: req.session.username,
            logged_in_profile_id,
            logged_in_profile_photo
        });
    } else {
        res.render('base', { 
            content: 'groups/groupHome',
            user_id: req.session.user_id 
        });
    }
});

//Create a new group
router.post('/create_group', async (req, res) => {
    try {
        const { name, description, parent_id, is_private, user_id } = req.body;
        const group_photo = req.body.new_group_profile_photo || "../static/images/site_images/blank-group-icon.jpg";
        const newGroup = await Groups.create({ 
            name, 
            description, 
            parent_id,
            is_private: is_private === 'on',
            group_photo,
        });

        //Add creating user to the group
        await UserGroups.create({
            user_id: user_id,
            group_id: newGroup.group_id
        });

        res.status(201).json(newGroup);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Create new channel within a group
router.post('/add_channel', async (req, res) => {
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
router.post('/join_group', async (req, res) => {
    try{
        const { group_id } = req.body;
        const user_id = req.session.userId;

        await UserGroups.create({
            user_id: user_id,
            group_id: group_id
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
