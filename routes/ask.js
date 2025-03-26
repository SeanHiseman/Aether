import authenticateCheck from '../functions/checks/authenticateCheck.js';
import dotenv from 'dotenv';
import OpenAI from "openai";
import { Router } from 'express';
import { v4 } from 'uuid';
import { AskChats, AskMessages, PostNotes, Users } from '../models/relationships.js';

dotenv.config();
const openai = new OpenAI();
const router = Router();
 
router.post('/ask_button', authenticateCheck, async (req, res) => {
    try {
        const { postTitle, postContent, id } = req.body;
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
        //Save note to correct table
        const newNote = await PostNotes.create({
            note_id: v4(),
            post_id: id,
            note_content: aiReply,
            created_at: Date.now(),
            is_misinfo: isMisinfo
        });
        res.status(200).json({ newNote });
    } catch (error) {
        res.status(500).json({ success: false });
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
        res.status(500).json({ esuccess: false });
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
        console.log(error);
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_ask_chat', authenticateCheck, async (req, res) => {
    try {
        const { chat_id } = req.body;
        await AskMessages.destroy({
            where: { chat_id }
        });
        await AskChats.destroy({
            where: { chat_id },
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
    }
});

router.post('/generate_content', authenticateCheck, async (req, res) => {
    try {
        const { currentCode, request, parentCode, senderId } = req.body;
        //console.log("req.body:", req.body);
        //Creates API assistant
        const assistant = await openai.beta.assistants.create({
            name: "Ask",
            instructions: "Generate or improve html content",
            model: "gpt-4o-mini",
        });
        //Send user message to OpenAI
        const thread = await openai.beta.threads.create();
        const userMessage = await openai.beta.threads.messages.create(
            thread.id,
            {
                role: "user",
                content: request
            }
        );
        const assistantInstructions = parentCode ? `Request and current code are for a reply to parent code. Answer with new or improved html code, containing JavaScript if necessary. Nothing else. Do not set body background colors, container borders, or text alignments. Do not use vh. Overflow hidden in body. White text default. If cannot be made into code, no response. Current code: ${currentCode}, parent code: ${parentCode}` 
        : `Answer with new or improved html code, containing JavaScript if necessary. Nothing else. Do not set body background colors, container borders, or text alignments. Do not use vh. Overflow hidden in body. White text default. If cannot be made into code, no response. Current code: ${currentCode}`;
        //console.log("assistantInstructions:", assistantInstructions);
        //Run OpenAI assistant
        const run = await openai.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: assistant.id, 
                instructions: assistantInstructions
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
        const chacaterCount = currentCode.length + (parentCode?.length ?? 0) + aiReply.length; //Parent code can be null
        //console.log("characterCount:", chacaterCount);
        await Users.increment('usage_count', { by: chacaterCount, where: { user_id: senderId } });
        aiReply = aiReply.replace(/^```[a-zA-Z]+\s*|```$/g, '').trim(); //Trims response
        //console.log("aiReply:", aiReply);
        res.status(201).json({ success: true, generatedContent: aiReply });
    } catch (error) {
        //console.log(error);
        res.status(500).json({ success: false });
    }
});

//Get messages within a specific chat
router.get('/get_ask_messages', authenticateCheck, async (req, res) => {
    //console.log("get_ask_messages request received");
    try {
        const chatId = req.query.chatId;
        const messages = await AskMessages.findAll({
            where: { chat_id: chatId },
            order: [['timestamp', 'DESC']]
        });
        //console.log("messages:", messages);
        res.status(200).json({ messages });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/send_ask_message', authenticateCheck, async (req, res) => {
    try {
        const { chatId, messageContent, senderId, timestamp } = req.body;
        console.log("req.body:", req.body);
        const chat = await AskChats.findOne({ where: { chat_id: chatId } });
        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }
        let { assistant_id, thread_id } = chat;
        if (!assistant_id || !thread_id) {
            const assistant = await openai.beta.assistants.create({
                name: "Ask",
                instructions: "Assist users",
                model: "gpt-4o-mini",
            });
            assistant_id = assistant.id;
            const thread = await openai.beta.threads.create();
            thread_id = thread.id;
            await AskChats.update(
                { assistant_id, thread_id },
                { where: { chat_id: chatId } }
            );
        }
        const userMessage = await openai.beta.threads.messages.create(
            thread_id,
            {
                role: "user",
                content: messageContent
            }
        );
        const run = await openai.beta.threads.runs.create(
            thread_id,
            {
                assistant_id: assistant_id, 
                instructions: "Your info:( Name: Ask, Site name: Aether) rules: (reply length < 5 sentences unless asked for more detail). Your abilities will be expanded soon."
            }
        );
        let runStatus = await openai.beta.threads.runs.retrieve(thread_id, run.id);
        while (runStatus.status !== "completed") {
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            runStatus = await openai.beta.threads.runs.retrieve(thread_id, run.id);
        }
        const messages = await openai.beta.threads.messages.list(thread_id);
        const aiReplyMessage = messages.data.find(msg => msg.role === 'assistant');
        const aiReply = aiReplyMessage ? aiReplyMessage.content[0].text.value : "I'm sorry, I couldn't process that.";
        console.log("aiReply:", aiReply);
        const newMessage = await AskMessages.create({
            message_id: v4(),
            chat_id: chatId,
            sender_id: senderId, 
            content: messageContent,
            timestamp: timestamp
        });
        const assistantMessage = await AskMessages.create({
            message_id: v4(),
            chat_id: chatId,
            sender_id: '00000000-0000-0000-0000-000000000000', 
            content: aiReply,
            timestamp: Date.now()
        });
        const chacaterCount = messageContent.length + aiReply.length;
        await AskChats.update(
            { updated_at: Date.now() },
            { where: { chat_id: chatId } }
        );
        await Users.increment('usage_count', { by: chacaterCount, where: { user_id: senderId } });
        res.status(201).json({ success: true, newMessage, assistantMessage });
    } catch (error) {
        console.log("error sending ask message:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


export default router;