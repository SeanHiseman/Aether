import authenticateCheck from '../functions/checks/authenticateCheck.js';
import Anthropic from '@anthropic-ai/sdk/index.mjs';
import dotenv from 'dotenv';
import OpenAI from "openai";
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { v4 } from 'uuid';
import { AskChats, AskMessages, PostNotes, Prompts, Users } from '../models/relationships.js';
import sequelize from '../databaseSetup.js';

dotenv.config();
const openai = new OpenAI();
const router = Router();
//const anthropic = new Anthropic({ 
    //apiKey: process.env.ANTHROPIC_API_KEY
//});

//ASSITANTS TO BE DEPRECATED
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_ask_chat', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { chat_id } = req.body;
        await AskMessages.destroy({ where: { chat_id }, transaction });
        await AskChats.destroy({ where: { chat_id }, transaction });
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
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
        const hasMembership = req.session.has_membership || false;
        const model = hasMembership ? 'gpt-5-mini' : 'gpt-5-nano'; 
        //GPT-5-mini 0.25/2.00, GPT-5 nano 0.05/0.40
        const inputMultiplier = hasMembership ? 2.5 : 0.5;
        const outputMultiplier = hasMembership ? 20 : 4; 
        const normalizedRequest = request.toLowerCase().trim();
        const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'with', 'for', 'on', 'at', 'by'];
        const tokens = normalizedRequest.split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.includes(word))
            .map(word => word.replace(/[^\w]/g, ''));
        let similarPrompt = null;
        if (tokens.length > 0) {
            const whereConditions = [];
            const significantTokens = tokens.slice(0, Math.min(tokens.length, 20));
            for (const token of significantTokens) {
                if (token.length > 2) {
                    whereConditions.push({
                        prompt_content: {
                            [Sequelize.Op.like]: `%${token}%`
                        }
                    });
                }
            }
            if (whereConditions.length > 0) {
                const potentialMatches = await Prompts.findAll({
                    where: {
                        [Sequelize.Op.or]: whereConditions
                    },
                    limit: 10
                });
                if (potentialMatches.length > 0) {
                    let bestMatch = null;
                    let bestScore = 0;
                    for (const prompt of potentialMatches) {
                        const promptText = prompt.prompt_content.toLowerCase();
                        const promptTokens = promptText.split(/\s+/)
                            .filter(word => word.length > 2 && !commonWords.includes(word))
                            .map(word => word.replace(/[^\w]/g, ''));
                        let matchingTokens = 0;
                        let totalTokens = new Set([...significantTokens, ...promptTokens]).size;
                        for (const token of significantTokens) {
                            if (promptTokens.includes(token)) {
                                matchingTokens++;
                            }
                        }
                        const jaccardSimilarity = matchingTokens / totalTokens;
                        const lengthRatio = Math.min(normalizedRequest.length, promptText.length) /
                                            Math.max(normalizedRequest.length, promptText.length);
                        const wordCountRatio = Math.min(normalizedRequest.split(/\s+/).length, promptText.split(/\s+/).length) /
                                                Math.max(normalizedRequest.split(/\s+/).length, promptText.split(/\s+/).length);
                        const combinedScore = (jaccardSimilarity * 0.6) + (lengthRatio * 0.2) + (wordCountRatio * 0.2);
                        if (combinedScore > 0.85 && (matchingTokens / significantTokens.length) >= 0.5 && combinedScore > bestScore) {
                            bestScore = combinedScore;
                            bestMatch = prompt;
                        }
                    }
                    if (bestMatch) {
                        similarPrompt = bestMatch;
                    }
                }
            }
        }
        let aiReply;
        let fromCache = false;
        if (similarPrompt) {
            aiReply = similarPrompt.response_content;
            fromCache = true;
            return res.status(201).json({
                success: true,
                generatedContent: aiReply,
                fromCache: true
            });
        }
        const assistantInstructions = 
            //parentCode ? `Generate or improve HTML code based on the following context:
            //Request: ${request}
            //Current Code: ${currentCode}
            //Parent Code: ${parentCode}
            //IMPORTANT: Return ONLY the raw HTML/Javascript  code without any explanations, comments, introductory text, or markdown formatting.
            //Do not include \`\`\`html, \`\`\`
            //Body background #232527 (unless specified), height 300px minimum. 
            //Use styles: --border: #3e3f41;--darkest: #0f0f0f; --dark: #232527; --light: #737484; --lightest: #dddddd;
            //White text as default
            //Ensure all interactions work on mobile and desktop.
            //If the request cannot be fulfilled with code, return nothing`
            //:
            `Generate or improve HTML code based on the following context:
            Request: ${request}
            Current Code: ${currentCode}
            IMPORTANT: Return ONLY the raw HTML/Javascript code without any explanations, comments, introductory text, or markdown formatting.
            Do not include \`\`\`html, \`\`\`
            Body background #232527 (unless specified), height 300px minimum. No body padding, main width 100% with no border.
            Use styles: --border: #3e3f41;--darkest: #0f0f0f; --dark: #232527; --light: #737484; --lightest: #dddddd;
            White text as default
            Ensure all interactions work on mobile and desktop.
            If the request cannot be fulfilled with code, return nothing`;
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: assistantInstructions
                }
            ],
            max_completion_tokens: hasMembership ? 128000 : 64000,
        });
        aiReply = completion.choices[0].message.content.trim();
        const doctypeIndex = aiReply.indexOf('<!DOCTYPE html>');
        if (doctypeIndex !== -1) {
            aiReply = aiReply.substring(doctypeIndex);
        }
        aiReply = aiReply.replace(/^```[a-zA-Z]*\s*|```$/g, '').trim();
        await Prompts.create({ prompt_id: v4(), prompt_content: request, response_content: aiReply});
        const inputTokens = completion.usage?.prompt_tokens || 0;
        const outputTokens = completion.usage?.completion_tokens || 0;
        const totalTokens = (inputTokens * inputMultiplier) + (outputTokens * outputMultiplier); 
		await Users.increment('usage_count', { by: totalTokens, where: { user_id: senderId } });
        res.status(201).json({ success: true, generatedContent: aiReply, fromCache: false });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false });
    }
});

//ASSITANTS TO BE DEPRECATED
router.post('/send_ask_message', authenticateCheck, async (req, res) => {
    try {
        const { chatId, messageContent, senderId, timestamp } = req.body;
        const chat = await AskChats.findOne({ where: { chat_id: chatId } });
        const userId = req.session.user_id
        const hasMembership = req.session.has_membership || false;
        const model = hasMembership ? 'gpt-4.1-mini' : 'gpt-4.1-nano';
        const tokenMultiplier = hasMembership ? 4 : 1;
        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }
        let { assistant_id, thread_id } = chat;
        if (!assistant_id || !thread_id) {
            const assistant = await openai.beta.assistants.create({
                name: "Ask",
                instructions: "Assist users",
                model: model,
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
		const inputTokens = runStatus.usage?.input_tokens || 0;
		const outputTokens = runStatus.usage?.output_tokens || 0;
		const totalTokens = (inputTokens + (outputTokens * 4)) * tokenMultiplier; //Multiplier adjustst for more expensive models, output tokens are 4x the cost of input tokens
		await Users.increment('usage_count', { by: totalTokens, where: { user_id: senderId } });
        res.status(201).json({ success: true, newMessage, assistantMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

export default router;