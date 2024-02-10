import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { v4 } from 'uuid';
import { Users, Profiles } from '../models/models.js';

const router = Router();

router.post('/register', async (req, res) => {
    try{
        const username = req.body.username;
        const password = req.body.password;

        //Check for existing username
        const existingUser = await Users.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).send('Username already taken');
        }

        //Add user info to database, including encrypted password
        const user_id = v4();
        const hashedPassword = await hash(password, 10);
        const UserSince = new Date();
        const newUser = await Users.create({
            user_id, username, password: hashedPassword, UserSince
        });

        //Set up initial profile
        const default_photo = 'frontend/public/media/images/site_images/blank-profile.png';
        const profile_id = v4();
        await Profiles.create({
            profile_id, user_id, profile_photo: default_photo, bio: ""
        });

        res.json({ success: true });
    }
    catch (error) {
        //If username is already taken
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).send('Username already taken');
        } else{
            console.error(error);
            res.status(500).send('Server Error');
        }
    }
});

router.post('/login', async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;

        const user = await Users.findOne({ where: { username }});

        if (user && await compare(password, user.password)) {
            req.session.user_id = user.user_id;
            req.session.username = user.username;
            res.json({ success: true });
        }
        else {
            res.json({ success: false, message: 'Invalid username or password' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy( err => {
        if(err){
            return res.json({ success: false, message: 'Failed to logout'});
        }
        res.clearCookie('sid');
        return res.json({ success: true });
    });

});

//Checks if user is logged in
router.get('/check_authentication', async (req, res) => {
    if (req.session && req.session.user_id) {
        try {
            const user = await Users.findByPk(req.session.user_id);
            if (!user) {
                return res.status(401).json({ error: 'Not authenticated'});
            }
            res.json({ authenticated: true, user: { username: user.username }});
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});


export default router;