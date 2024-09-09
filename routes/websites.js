//import authenticateCheck from "../functions/checks/authenticateCheck";
import axios from 'axios';
import dotenv from 'dotenv';
import { Router } from 'express';

dotenv.config();
const router = Router();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCb8fvnW_oO5EsjV1X3ENS6g';

router.get('/youtube_content', async (req, res) => {
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: {
                key: YOUTUBE_API_KEY,
                channelId: CHANNEL_ID,
                part: 'snippet',
                maxResults: 3,
                order: 'date'
            }
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.log("error:", error);
        res.status(500).json({ success: false });
    }
});

export default router;