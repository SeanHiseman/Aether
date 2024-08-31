import authenticateCheck from '../functions/authenticateCheck.js';
import dotenv from 'dotenv';
import OpenAI from "openai";
import { Router } from 'express';
import { v4 } from 'uuid';
import { AskChats, AskMessages, AskNotes } from '../models/models.js';

dotenv.config();
const openai = new OpenAI();
const router = Router();

router.post('/ask_button', authenticateCheck, async (req, res) => {
    try {
        const { postTitle, postContent, postId } = req.body;
        const combinedContent = `Title: ${postTitle}, Content: ${postContent}`;

        //Creates API assistant
        const assistant = await openai.beta.assistants.create({
            name: "Ask",
            instructions: "Correct misinformation",
            model: "gpt-4o-mini",
        });
        //Send user message to OpenAI
        const thread = await openai.beta.threads.create();
        const post = await openai.beta.threads.messages.create(
            thread.id,
            {
                role: "user",
                content: combinedContent
            }
        );
        //Run OpenAI assistant
        const run = await openai.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: assistant.id, 
                instructions: "Begin with 'MISINFO:' if misinformation is present, followed by rest of message: Definite tone, no misinfo mention if none present, instead make regular comment. Reply length < 3 sentences if possible"
            }
        );
        //Wait for OpenAI response
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        while (runStatus.status !== "completed") {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        }
        //Get OpenAI response
        const messages = await openai.beta.threads.messages.list(thread.id);
        let aiReply = messages.data.find(msg => msg.role === 'assistant').content[0].text.value;
        const isMisinfo = aiReply.trim().startsWith('MISINFO:');
        if (isMisinfo) {
            //Remove 'MISINFO:' from beginning of message
            aiReply = aiReply.replace(/^MISINFO:\s*/, '');
        }
        //Save user message 
        const newNote = await AskNotes.create({
            note_id: v4(),
            post_id: postId,
            note_content: aiReply,
            timestamp: Date.now(),
            is_misinfo: isMisinfo
        });
        res.status(200).json({ newNote });
    } catch (error) {
        res.status(500).json({ error: "Ask button error" });
    }
});

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
        await AskMessages.destroy({
            where: {
                chat_id: chat_id
            }
        });
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

//Get messages within a specific chat
router.get('/get_ask_messages', authenticateCheck, async (req, res) => {
    try {
        const chatId = req.query.chatId;
        const messages = await AskMessages.findAll({
            where: { chat_id: chatId },
            order: [['timestamp', 'DESC']]
        });
        res.status(200).json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Error getting Ask chats' });
    }
});

router.post('/send_ask_message', authenticateCheck, async (req, res) => {
    try {
        const { chatId, messageContent, senderId, timestamp } = req.body;

        //Creates API assistant
        const assistant = await openai.beta.assistants.create({
            name: "Ask",
            instructions: "Assist users",
            model: "gpt-4o-mini",
        });

        //Send user message to OpenAI
        const thread = await openai.beta.threads.create();
        const userMessage = await openai.beta.threads.messages.create(
            thread.id,
            {
                role: "user",
                content: messageContent
            }
        );

        //Run OpenAI assistant
        const run = await openai.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: assistant.id, 
                instructions: "Your info:( Name: Ask, Site name: Aether) rules: (reply length < 3 sentences if possible) "
            }
        );

        //Wait for OpenAI response
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        while (runStatus.status !== "completed") {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        }

        //Get OpenAI response
        const messages = await openai.beta.threads.messages.list(thread.id);
        const aiReply = messages.data.find(msg => msg.role === 'assistant').content[0].text.value;

        //Save user message 
        const newMessage = await AskMessages.create({
            message_id: v4(),
            chat_id: chatId,
            sender_id: senderId,
            message_content: messageContent,
            timestamp: timestamp
        });

        //Save reply
        const assistantMessage = await AskMessages.create({
            message_id: v4(),
            chat_id: chatId,
            sender_id: 'ask', //distinguishes from human messages
            message_content: aiReply,
            timestamp: Date.now()
        });

        //Update chat timestamp
        await AskChats.update(
            { updated_at: Date.now() },
            { where: { chat_id: chatId } }
        );
        
        res.status(201).json({ success: true, userMessage: newMessage, assistantMessage });
    } catch (error) {
        res.status(500).json({ error: 'Error sending message' });
    }
});

export default router;