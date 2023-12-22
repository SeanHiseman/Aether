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
        const { name, description, parent_id } = req.body;
        const newGroup = await Groups.create({ name, description, parent_id});
        res.status(201).json(newGroup);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Create new channel within a group
router.post('/groups/:groupId/channels', async (req, res) => {
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

export default router;
