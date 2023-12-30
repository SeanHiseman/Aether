import { Router } from 'express';
import { hash, compare } from 'bcrypt';
import { v4 } from 'uuid';
import { Users, Profiles } from '../models/models.js';

const router = Router();

router.get('/register', (req, res) => {
    res.render('site_entrance/register');
});

router.post('/register', async (req, res) => {
    try{
        const user_id = v4();
        const username = req.body.username;
        const password = req.body.password;

        //Add user info to database, including encrypted password
        const hashedPassword = await hash(password, 10);
        const UserSince = new Date();
        const newUser = await Users.create({
            user_id, username, password: hashedPassword, UserSince
        });

        //Set up initial profile
        const default_photo = '/images/site_images/blank-profile.png';
        const profile_id = v4();
        await Profiles.create({
            profile_id, user_id, profile_photo: default_photo, bio: ""
        });

        res.redirect('/login');
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

router.get('/login', (req, res) => {
    res.render('site_entrance/login');
});

router.post('/login', async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;

        const user = await Users.findOne({ where: { username }});

        if (user && await compare(password, user.password)) {
            req.session.user_id = user.user_id;
            req.session.username = user.username;
            res.redirect('/home');
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
        return res.redirect('/login');
    });

});

export default router;