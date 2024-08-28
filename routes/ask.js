import authenticateCheck from '../functions/authenticateCheck.js';
import { Router } from 'express';
import { Op } from 'sequelize';
import { v4 } from 'uuid';
import { AskChats, AskMessages, Users } from '../models/models.js';

const router = Router();

router.post('/change_ask_chat_name', authenticateCheck, async (req, res) => {
    try {
        const { chatId, newName } = req.body;
        await AskChats.update(
            { name: newName },
            { where: { chat_id: chatId } }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error changing chat name"});
    }
});

router.post('/create_ask_chat', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        const { chatId, chatName } = req.body;
        const newChat = await AskChats.create({
            chat_id: chatId,
            name: chatName,
            user_id: userId
        });
        res.status(201).json(newChat);
    } catch (error) {
        res.status(500).json({ error: 'Error creating chat' });
    }
});

router.delete('/delete_ask_chat', authenticateCheck, async (req, res) => {
    try {
        const { chat_id } = req.body;
        await AskChats.destroy({
            where: { 
                chat_id: chat_id
            },
        });
        res.status(200).json({ message: 'Chat deleted successfully '});
    } catch (error) {
        res.status(500).json({ error: 'Error deleting chat' });
    }
});

//Returns all of a users chats with Ask
router.get('/get_ask_chats', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        const chats = await AskChats.findAll({
            where: { user_id: userId },
            order: [['updated_at', 'DESC']]
        });
        res.status(200).json({ chats });
    } catch (error) {
        res.status(500).json({ error: 'Error getting Ask chats' });
    }
});

router.post('/send_ask_message', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;

        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error sending message' });
    }
});

export default router;