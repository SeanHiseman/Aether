import { Router } from 'express';
import { v4 } from 'uuid';
import { Op, Sequelize } from 'sequelize';
import { Chats, Connections, ConnectRequests, FeedChats, Feeds, Messages } from '../models/relationships.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';

const router = Router();

const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'date_created', 'type', 'is_group', 'feed_owner'];

router.post('/accept_connect_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverId, senderId } = req.body;
        const connectRequest = await ConnectRequests.findOne({
            where: { receiver_id: receiverId, sender_id: senderId }
        });
        await Connections.create({
            connection_id: v4(),
            feed1_id: senderId,
            feed2_id: receiverId,
            connection_date: new Date()
        });;
        const chat = await Chats.create({ 
            chat_id: v4(),
            title: "Main"
        });
        await FeedChats.bulkCreate([
            { feed_id: senderId, chat_id: chat.chat_id },
            { feed_id: receiverId, chat_id: chat.chat_id }
        ]);
        await connectRequest.destroy();
        res.status(200).json({ isConnected: true, success: true });
    } catch (error) {
        res.status(500).json({ isConnected: false, success: false });
    }
});

router.post('/change_chat_name', authenticateCheck, async (req, res) => {
    try {
        const { chatId, newTitle } = req.body;
        if (newTitle === 'Main') {
            res.status(403).json({ success: false });
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
        const feedChats = participants.map(participant => ({
            feed_id: participant.feed_id,
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

router.delete('/delete_connect_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverId, senderId } = req.body;
        const deleteCount = await ConnectRequests.destroy({
            where: { sender_id: senderId, receiver_id: receiverId } 
        });
        if (deleteCount > 0) {
            res.status(200).json({ isConnected: false, success: true });
        } else {
            res.status(500).json({ isConnected: false,  success: false });
        }
    } catch (error) {
        res.status(500).json({ isConnected: false,  success: false });
    }
});

router.delete('/delete_connection', authenticateCheck, async (req, res) => {
    try {
        const { deleterId, feedId } = req.body;
        await Connections.destroy({
            where: { 
                [Op.or]: [
                    { feed1_id: deleterId, feed2_id: feedId },
                    { feed1_id: feedId, feed2_id: deleterId },
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
            await Messages.destroy({
                where: { chat_id: chat.chat_id }
            });
            await FeedChats.destroy({
                where: {
                    chat_id: chat.chat_id,
                    [Op.or]: [
                        { feed_id: deleterId },
                        { feed_id: feedId }
                    ]
                }
            });
            await Chats.destroy({
                where: { chat_id: chat.chat_id }
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

router.get('/get_chats/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params;
        const { connectionName } = req.query;
        const whereName = connectionName ? { feed_name: connectionName } : {};
        const feedChats = await Chats.findAll({
            include: [{
                model: Feeds, 
                as: 'feeds',
                attributes: feedAttributes,
                where: whereName,
                through: { attributes: [] },
            }],
            order: [['updated_at', 'ASC']]
        });
        const result = feedChats.map(chat => {
            const otherFeeds = chat.feeds.filter(feed => feed.feed_id !== feedId);
            return {
                ...chat.toJSON(),
                feeds: otherFeeds,
            }
        });
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_connections/:feedId', authenticateCheck, async (req, res) => {
    try {
        const feedId = req.params.feedId;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        if (!feed) { 
            return res.status(404).json({ success: false, message: 'Feed not found' }) 
        }
        const connections = await Connections.findAll({
            where: {
                [Op.or]: [
                    { feed1_id: feedId },
                    { feed2_id: feedId }
                ]
            },
            //More recent connections are first
            order: [['connection_date', 'ASC']],
            include: [{
                model: Feeds,
                as: 'Feed1',
                attributes: feedAttributes
            }, {
                model: Feeds,
                as: 'Feed2',
                attributes: feedAttributes
            }]
        });
        const filteredConnections = connections.map(connection => {
            const otherFeed = connection.feed1_id === feedId ? connection.Feed2 : connection.Feed1;
            return {
                ...otherFeed.toJSON(),   // Return other feed's details
                connection_id: connection.connection_id,
                connection_date: connection.connection_date
            };
        });
        //console.log("connections:", connections);
        //res.status(200).json(connections);
        res.status(200).json(filteredConnections);
    } catch (error) {
        res.status(500).json({ success: false });  
    }
});

router.get('/get_connect_requests/:feedId', authenticateCheck, async (req, res) => {
    const feedId = req.params.feedId;
    try {
        const requests = await ConnectRequests.findAll({ 
            where: { receiver_id: feedId },
            attributes: {
                include: [[Sequelize.col('sender.feed_id'), 'feed_id']], //So matches connect button data format
            },
            include: [{
                model: Feeds, 
                as: 'sender',
                required: true,
                attributes: feedAttributes,
            }],
        });
        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/send_connect_request', authenticateCheck, async (req, res) => {
    try {
        const { receiverId, senderId } = req.body;
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
