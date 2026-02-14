import authenticateCheck from '../functions/checks/authenticateCheck.js';
import Anthropic from '@anthropic-ai/sdk/index.mjs';
import dotenv from 'dotenv';
import OpenAI from "openai";
import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { v4 } from 'uuid';
import { AskChats, AskMessages, ExternalPosts, PostNotes, Posts, Prompts, Users } from '../models/relationships.js';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
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

const contextNoteSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. Your role is to provide conext for given social media posts.
Only fact-check posts that are clearly *not* humerous, ironic or a joke. Leave a light-hearted comment if the post is a joke, irony or humor, but do not fact-check it.
Do not dispute, or use your own knowledge, for events between this date and 1 November 2024, unless via websearch you can verifiably be certain they did not happen.
Always use your web search results over your built-in knowledge when checking facts, especially for recent events.
You will receive a social media post. The post may contain plain text, opinions, news claims, code snippets, or a mix of these, or other content. Images may also be attached.
Analyze the post for factual accuracy. If misinformation is present, begin your response with 'MISINFO:' followed by a correction of no more than 500 words.
If no misinformation is found, provide brief additional context about the topic, no more than 100 words.
For code-heavy posts, focus on any factual claims rather than code correctness.
Use a friendly, informative and brief tone. Remember that you are talking directly to the user about the post.
No emojis. Be direct and to the point, no starting with 'It seems...', or 'The post...' etc. Elsewhere, refer to the post as 'the post' or 'the content' rather than 'you' or 'the user'.
If you have sources, list them at the end under a "Sources:" heading, one per line as markdown links: [Title](url). Do not inline source URLs in the main text.
Prioritise the most recent sources, be wary of out-of-date information before making a claim. Never rever to yourself. No emojis or em dashes or surrounding words with asterisks.`;

async function generateContextNote({ textContent, imageUrls = [] }) {
    //Use Claude vision when images are present, otherwise use Grok with web search
    if (imageUrls.length > 0) {
        const content = [{ type: 'text', text: textContent }];
        for (const url of imageUrls.slice(0, 4)) {
            content.push({ type: 'image', source: { type: 'url', url } });
        }
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            system: contextNoteSystemPrompt,
            messages: [{ role: 'user', content }]
        });
        //Format to match OpenAI-style response for consistent handling
        return { choices: [{ message: { content: response.content[0].text } }] };
    }
    return xai.chat.completions.create({
        model: 'grok-4-1-fast-reasoning',
        search_mode: 'on',
        messages: [
            { role: 'system', content: contextNoteSystemPrompt },
            { role: 'user', content: textContent }
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
async function createContextNote({ postContent, postId, isExternal, parentContent, quotedContent, imageUrls = [] }) {
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
        //Build enriched text content with parent/quoted context
        let textContent = '';
        if (parentContent) textContent += `This post is a reply to: """${parentContent}"""\n`;
        if (quotedContent) textContent += `This post quotes: """${quotedContent}"""\n`;
        textContent += `Post content: ${postContent}`;
        const completion = await generateContextNote({ textContent, imageUrls });
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
        let parentContent = null;
        let quotedContent = null;
        let imageUrls = [];
        if (isExternal) {
            const extPost = await ExternalPosts.findByPk(postId, {
                attributes: ['parent_id', 'quoted_external_post_id', 'content']
            });
            if (extPost) {
                if (extPost.parent_id) {
                    const parent = await ExternalPosts.findByPk(extPost.parent_id, { attributes: ['text_body', 'title'] });
                    if (parent) parentContent = `${parent.title ? parent.title + ': ' : ''}${parent.text_body || ''}`;
                }
                if (extPost.quoted_external_post_id) {
                    const quoted = await ExternalPosts.findByPk(extPost.quoted_external_post_id, { attributes: ['text_body', 'title'] });
                    if (quoted) quotedContent = `${quoted.title ? quoted.title + ': ' : ''}${quoted.text_body || ''}`;
                }
                //Extract image URLs from external post HTML content
                if (extPost.content) {
                    const $ = cheerio.load(extPost.content);
                    $('img').each((_, el) => {
                        const src = $(el).attr('src');
                        if (src) imageUrls.push(src);
                    });
                }
            }
        } else {
            const post = await Posts.findByPk(postId, {
                attributes: ['parent_id', 'quoted_post_id', 'quoted_external_post_id', 'content']
            });
            if (post) {
                if (post.parent_id) {
                    const parent = await Posts.findByPk(post.parent_id, { attributes: ['text_body', 'title'] });
                    if (parent) parentContent = `${parent.title ? parent.title + ': ' : ''}${parent.text_body || ''}`;
                }
                if (post.quoted_post_id) {
                    const quoted = await Posts.findByPk(post.quoted_post_id, { attributes: ['text_body', 'title'] });
                    if (quoted) quotedContent = `${quoted.title ? quoted.title + ': ' : ''}${quoted.text_body || ''}`;
                }
                if (post.quoted_external_post_id) {
                    const quoted = await ExternalPosts.findByPk(post.quoted_external_post_id, { attributes: ['text_body', 'title'] });
                    if (quoted) quotedContent = `${quoted.title ? quoted.title + ': ' : ''}${quoted.text_body || ''}`;
                }
                //Extract image URLs from native post HTML content
                if (post.content) {
                    try {
                        let html;
                        if (post.content.startsWith('http')) {
                            const resp = await fetch(post.content);
                            html = await resp.text();
                        } else {
                            const filePath = path.join(process.cwd(), post.content);
                            if (fs.existsSync(filePath)) html = fs.readFileSync(filePath, 'utf-8');
                        }
                        if (html) {
                            const $ = cheerio.load(html);
                            $('img').each((_, el) => {
                                const src = $(el).attr('src');
                                if (src) imageUrls.push(src);
                            });
                        }
                    } catch (err) {
                        console.error('Failed to extract images from native post:', err);
                    }
                }
            }
        }
        //Only keep absolute URLs (Claude vision API can't access relative/local paths)
        imageUrls = imageUrls.filter(url => url.startsWith('http'));
        const result = await createContextNote({ postContent, postId, isExternal, parentContent, quotedContent, imageUrls });
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