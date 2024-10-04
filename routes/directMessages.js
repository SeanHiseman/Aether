import { Router } from 'express';
import { v4 } from 'uuid';
import { Op } from 'sequelize';
import { Feeds } from '../models/feeds.js';
import { Chats, Connections, ConnectRequests, FeedChats, Messages } from '../models/messages.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';

const router = Router();

const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'date_created', 'type', 'is_group', 'feed_owner'];

router.post('/accept_connect_request', authenticateCheck, async (req, res) => {
    try {
        const { request } = req.body;
        const connectRequest = await ConnectRequests.findByPk(request.request_id);
        await Connections.create({
            conection_id: v4(),
            feed1_id: friendRequest.sender_id,
            feed2_id: friendRequest.receiver_id,
            connected_date: new Date()
        });
        const chat = await Chats.create({ 
            chat_id: v4(),
            title: "Main"
        });
        await FeedChats.bulkCreate([
            { feed_id: connectRequest.sender_id, chat_id: chat.chat_id },
            { feed_id: connectRequest.receiver_id, chat_id: chat.chat_id }
        ]);
        await connectRequest.destroy();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_connect_request', authenticateCheck, async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        await ConnectRequests.destroy({
            where: { sender_id: senderId, receiver_id: receiverId } 
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Changes name of chat between users
router.post('/change_chat_name', authenticateCheck, async (req, res) => {
    try {
        const { chatId, newTitle } = req.body;
        if (newTitle === 'Main') {
            res.status(403).json({ success: false, message: "Chat can't be called main"})
        } else {
            await Chats.update(
                { title: newTitle },
                { where: { chat_id: chatId } }
            );
            res.status(200).json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/create_chat', authenticateCheck, async (req, res) => {
    try {
        const { participants, title } = req.body;
        const newChat = await Chats.create({
            chat_id: v4(),
            title: title
        });
        const feedChats = participants.map(feedId => ({
            feed_id: feedId,
            chat_id: newChat.chat_id,
        }));
        await FeedChats.bulkCreate(feedChats);
        res.status(201).json(newChat);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_chat', authenticateCheck, async (req, res) => {
    try {
        const { chatId, title } = req.body;
        //Main channels are default, so can't be deleted
        if (title === 'Main') {
            res.status(403).json({ message: 'Main chats cannot be deleted' });
        } else {
            await FeedChats.destroy({
                where: { 
                    chat_id: chatId
                },
            });
            await Chats.destroy({
                where: { 
                    chat_id: chatId
                },
            });
            res.status(200).json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_connection', authenticateCheck, async (req, res) => {
    try {
        const { deleterId, feedId } = req.body;
        await Connections.destroy({
            where: { 
                [Op.or]: [
                    { feed1_id: deleterId, user2_id: feedId },
                    { feed2_id: feedId, user1_id: deleterId },
                ]
            }
        });
        const chats = await Chats.findAll({
            include: [{
                model: FeedChats,
                where: { 
                    [Op.or]: [
                        { feed_id: deleterId },
                        { feed_id: feedId }
                    ]
                }
            }]
        });
        for (const chat of chats) {
            //Deletes all messages in the chat
            await Messages.destroy({
                where: {
                    chat_id: chat.chat_id
                }
            });
            //Removes both users from the chat
            await FeedChats.destroy({
                where: {
                    chat_id: chat.chat_id,
                    [Op.or]: [
                        { feed_id: deleterId },
                        { feed_id: feedId }
                    ]
                }
            });
            //Deletes the chat
            await Chats.destroy({
                where: {
                    chat_id: chat.chat_id
                }
            });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_chat_messages/:chatId', authenticateCheck, async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const messages = await Messages.findAll({
            where: { chat_id: chatId },
            include: [{
                model: Feeds,
                attributes: ['feed_id', 'feed_name', 'feed_photo'],
            }],
            order: [['timestamp', 'ASC']]
        });
        const messagesData = messages.map(m => ({
            messageId: m.message_id, 
            senderId: m.sender_id,
            messageContent: m.message_content,
            timestamp: m.timestamp,
        }));
        res.json(messagesData);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_chats', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const feedChatIds = await FeedChats.findAll({
            where: { feed_id: feedId },
            attributes: ['chat_id'],
        });
        const chatIds = feedChatIds.map(c => c.chat_id);
        const chats = await Chats.findAll({
            where: { chat_id: chatIds },
            include: [{
                model: Feeds,
                attributes: ['feed_id', 'feed_name', 'feed_photo'],
                required: false
            }],
            order: [['updated_at', 'ASC']]
        });
        const chatsData = chats.map(chat => {
            const participants = chat.feeds.map(user => ({
                userId: user.user_id,
                username: user.username
            }));
            return {
                chatId: chat.chat_id,
                title: chat.title,
                participants: participants,
                createdAt: chat.created_at,
                updatedAt: chat.updated_at
            };
        });
        res.json(chatsData);
    } catch (error) {
       res.status(500).json({ success: false });
    }
});

router.get('/get_connections', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        if (!feed) { 
            return res.status(404).json({ success: false, message: 'Feed not found' }) 
        }
        const connections = await Connections.findAll({
            where: {
                [Op.or]: [
                    { feed1_id: feed.feed_id },
                    { feed2_id: feed.feed_id }
                ]
            },
            //More recent connections are first
            order: [['connection_date', 'ASC']]
        });
        const connectData = await Promise.all(connections.map(async (connection) => {
            const connectedFeedId = (connection.feed1_id !== feed.feed_id) ? connection.feed1_id : connection.feed2_id;
            const connectedFeed = await Feeds.findByPk(connectedFeedId);
            return {
                connection_id: connection.connection_id,
                connection_date: connection.connection_date,
                connectedFeed: {
                    feed_id: connectedFeed.feed_id,
                    feed_name: connectedFeed.feed_name
                }
            };
        }));
        res.json({ success: true, connections: connectData });
    } catch (error) {
        res.status(500).json({ success: false });  
    }
});

router.get('/get_connect_requests/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const requests = await ConnectRequests.findAll({ 
            where: { receiver_id: feedId },
            include: [{
                model: Feeds, 
                as: 'sender',
                required: true,
                attributes: feedAttributes,
            }],
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/send_connect_request', authenticateCheck, async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        await ConnectRequests.create({
            request_id: v4(),
            sender_id: senderId,
            receiver_id: receiverId
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

export const directMessagesSocket = (socket) => {
    try {
        socket.on('join_chat', (chatId) => {
            socket.join(chatId);
        });
        socket.on('leave_chat', (chatId) => {
            socket.leave(chatId);
        });
        socket.on('delete_message', async (data) => {
            const { message_id, channel_id } = data;
            await Messages.destroy({ where: { message_id } });
            socket.to(channel_id).emit('delete_message', { message_id });
        });
        socket.on('send_direct_message', async (message) => {
            const messageLength = message.message_content.length;
            if (messageLength === 0) {
                socket.emit('error_message', { error: "Message too short" });
                return;
            } else if (messageLength > 1000) {
                socket.emit('error_message', { error: "Message too long" });
                return;
            }
            const newMessage = await Messages.create({
                message_id: message.message_id,
                chat_id: message.chatId,
                sender_id: message.senderId,
                message_content: message.message_content,
                timestamp: message.timestamp
            });
            socket.to(message.chatId).emit('message_confirmed', {
                ...message,
                message_id: newMessage.message_id,
                timestamp: newMessage.timestamp
            }); 
        });
    } catch (error) {
        console.error(error);
    }
};

export default router;
