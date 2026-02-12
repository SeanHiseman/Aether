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
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const xai = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1'
});

async function generateContextNote(postContent) {
    return xai.chat.completions.create({
        model: 'grok-3-mini',
        search_mode: 'auto',
        messages: [
            {
                role: 'system',
                content: `You will receive a social media post. The post may contain plain text, opinions, news claims, code snippets, or a mix of these, or other content.
                Analyze the post for factual accuracy. If misinformation is present, begin your response with 'MISINFO:' followed by a correction of no more than 500 words.
                If no misinformation is found, provide brief additional context about the topic, no more than 100 words.
                For code-heavy posts, focus on any factual claims rather than code correctness.
                Use a friendly, informative and brief tone. Remember that you are talking directly to the user about the post. 
                No emojis. Be direct and to the point, no starting with 'It seems...', or 'The post...' etc. Elsewhere, refer to the post as 'the post' or 'the content' rather than 'you' or 'the user'.
                If you have sources, list them at the end under a "Sources:" heading, one per line as markdown links: [Title](url). Do not inline source URLs in the main text. 
                Prioritise the most recent sources, be wary of out-of-date information before making a claim.`
            },
            {
                role: 'user',
                content: postContent
            }
        ]
    });
}

//Tracks post IDs currently being generated to prevent duplicate generation
const generatingNotes = new Set();

export { generateContextNote, xai };

/**
 * Creates a context note for a post. Handles race conditions via an in-memory lock.
 * Used by both /context_button and auto-generation in /create_post.
 * Returns the note object, or null if generation is already in progress.
 */
async function createContextNote({ postContent, postId, isExternal }) {
    const lockKey = `${isExternal ? 'ext' : 'nat'}_${postId}`;
    //Check if note already exists
    const whereClause = isExternal
        ? { external_post_id: postId }
        : { post_id: postId };
    const existingNote = await PostNotes.findOne({ where: whereClause });
    if (existingNote) return { note: existingNote, alreadyExisted: true };
    //Check if generation is already in progress
    if (generatingNotes.has(lockKey)) return { note: null, generating: true };
    //Claim the lock and generate
    generatingNotes.add(lockKey);
    try {
        const completion = await generateContextNote(postContent);
        let aiReply = completion.choices[0].message.content;
        const isMisinfo = aiReply.trim().startsWith('MISINFO:');
        if (isMisinfo) {
            aiReply = aiReply.replace(/^MISINFO:\s*/, '');
        }
        const noteData = {
            note_id: v4(),
            note_content: aiReply,
            created_at: Date.now(),
            is_misinfo: isMisinfo
        };
        if (isExternal) {
            noteData.external_post_id = postId;
        } else {
            noteData.post_id = postId;
        }
        const newNote = await PostNotes.create(noteData);
        return { note: newNote, alreadyExisted: false };
    } finally {
        generatingNotes.delete(lockKey);
    }
}

export { createContextNote };

router.post('/context_button', authenticateCheck, async (req, res) => {
    try {
        const hasMembership = req.session.has_membership || false;
        if (!hasMembership) {
            return res.status(403).json({ success: false, message: 'Membership required' });
        }
        const { postContent, postId, isExternal } = req.body;
        const result = await createContextNote({ postContent, postId, isExternal });
        if (result.generating) {
            return res.status(202).json({ generating: true });
        }
        res.status(200).json({ newNote: result.note });
    } catch (error) {
        console.error('Context button error:', error);
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
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({ success: false, error: 'Request timeout' });
        }
    }, 120000); //2 minute timeout
    try {
        const { currentCode, request, senderId } = req.body;
        console.log('Received request:', { currentCode, request, senderId });
        const hasMembership = req.session.has_membership || false;
        const model = hasMembership ? 'claude-sonnet-4-5-20250929' : 'claude-3-5-haiku-20241022';
        const inputMultiplier = hasMembership ? 3.0 : 0.25;
        const outputMultiplier = hasMembership ? 15.0 : 1.25;
        const assistantInstructions = 
            `Generate or improve HTML code based on the following context:
            Request: ${request},
            Current Code: ${currentCode},
            IMPORTANT: Return ONLY the raw HTML/Javascript code without any explanations, comments, introductory text, or markdown formatting.
            Do not include \`\`\`html, \`\`\`.

            DEFAULT STYLES:
            Min-height 100vh, no body padding, main width 100% with no border, minimal padding and margins, no colour gradients, white text. Modern, sleek styling. 
            IGNORE THESE STYLES IF REQUEST SPECIFIES OTHERWISE.

            Ensure all interactions work on mobile and desktop.
            If the request cannot be fulfilled with code, return nothing`;
        const completion = await anthropic.messages.create({
            model: model,
            max_tokens: hasMembership ? 16384 : 8192,
            messages: [
                {
                    role: 'user',
                    content: assistantInstructions
                }
            ],
        });
        clearTimeout(timeout);
        let aiReply = completion.content[0].text.trim();
        console.log('AI Reply before processing length:', aiReply.length);
        const doctypeIndex = aiReply.indexOf('<!DOCTYPE html>');
        if (doctypeIndex !== -1) {
            aiReply = aiReply.substring(doctypeIndex);
        }
        aiReply = aiReply.replace(/^```[a-zA-Z]*\s*|```$/g, '').trim();
        const inputTokens = completion.usage?.input_tokens || 0;
        const outputTokens = completion.usage?.output_tokens || 0;
        const totalTokens = (inputTokens * inputMultiplier) + (outputTokens * outputMultiplier);
        await Users.increment('usage_count', { 
            by: totalTokens, 
            where: { user_id: senderId } 
        });
        await Prompts.create({
            prompt_id: v4(),
            prompt_content: request,
            response_content: aiReply
        });
        res.status(201).json({ success: true, generatedContent: aiReply});
    } catch (error) {
        clearTimeout(timeout);
        console.error(new Date().toISOString(), '/generate_content error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
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