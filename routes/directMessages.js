import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { Router } from 'express';
import { v4 } from 'uuid';
import { Op, Sequelize } from 'sequelize';
import { Chats, Connections, ConnectRequests, FeedChats, Feeds, Messages } from '../models/relationships.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import sequelize from '../databaseSetup.js';

dotenv.config();
const router = Router();
const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;

const feedAttributes = ['feed_id', 'parent_id', 'feed_name', 'description', 'feed_photo', 'follower_count', 'created_at', 'updated_at', 'type', 'is_group', 'feed_owner'];

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
        const encryptedTitle = CryptoJS.AES.encrypt("Main", SECRET_KEY).toString();
        const chat = await Chats.create({ 
            chat_id: v4(),
            title: encryptedTitle
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
        const { channelId, newChannelName } = req.body;
        await Chats.update(
            { title: newChannelName },
            { where: { chat_id: channelId } }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.post('/create_chat', authenticateCheck, async (req, res) => {
    try {
        const { participants, title } = req.body; 
        console.log("req.body:", req.body);
        if (title.length === 0) {
            res.status(403).json({ success: false, message: 'Title cannot be empty' });
        }
        const newChat = await Chats.create({
            chat_id: v4(),
            title: title
        });
        const feedChats = participants.map(participant => ({
            feed_id: participant.feed_id,
            chat_id: newChat.chat_id,
        }));
        await FeedChats.bulkCreate(feedChats);
        res.status(201).json({ success: true, newChat });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_chat', authenticateCheck, async (req, res) => {
    try {
        const { channelId } = req.body;
        await Messages.destroy({
            where: {
                chat_id: channelId
            }
        })
        await FeedChats.destroy({
            where: { 
                chat_id: channelId
            },
        });
        await Chats.destroy({
            where: { 
                chat_id: channelId
            },
        });
        res.status(200).json({ success: true });
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
    const transaction = await sequelize.transaction(); 
    try {
        const { deleterId, feedId } = req.body;
        await Connections.destroy({
            where: { 
                [Op.or]: [
                    { feed1_id: deleterId, feed2_id: feedId },
                    { feed1_id: feedId, feed2_id: deleterId },
                ]
            },
            transaction
        });
        const feedChats = await FeedChats.findAll({
            where: {
                [Op.or]: [
                    { feed_id: deleterId },
                    { feed_id: feedId }
                ]
            },
            transaction
        });
        const chatIds = feedChats.map(fc => fc.chat_id);
        if (chatIds.length > 0) {
            await FeedChats.destroy({
                where: {
                    chat_id: chatIds
                },
                transaction
            });
            await Messages.destroy({
                where: {
                    chat_id: chatIds
                },
                transaction
            });
            await Chats.destroy({
                where: {
                    chat_id: chatIds
                },
                transaction
            });
        }
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ success: false });
    }
});


router.get('/get_chat_messages/:channelId', authenticateCheck, async (req, res) => {
    try {
        const { channelId } = req.params;
        const messages = await Messages.findAll({
            where: { chat_id: channelId },
            include: [{
                model: Feeds,
                attributes: feedAttributes,
            }],
            order: [['timestamp', 'ASC']]
        });;
        res.status(200).json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_chats/:feedId', authenticateCheck, async (req, res) => {
    try {
        const viewerFeedId = req.params.feedId;
        const { connectionName } = req.query;
        const connectionFeed = await Feeds.findOne({
            where: { feed_name: connectionName },
            attributes: feedAttributes
        });
        if (!connectionFeed) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }
        const connectionFeedId = connectionFeed.feed_id;
        const chatsWithViewerFeed = await FeedChats.findAll({
            where: {
                feed_id: viewerFeedId
            },
            attributes: ['chat_id']
        });
        const chatIdsWithViewerFeed = chatsWithViewerFeed.map(chat => chat.chat_id);
        const chatsWithConectionFeed = await FeedChats.findAll({
            where: {
                feed_id: connectionFeedId
            },
            attributes: ['chat_id']
        });
        const chatIdsWithConnectionFeed = chatsWithConectionFeed.map(chat => chat.chat_id);
        const chatIds = chatIdsWithViewerFeed.filter(chatId => 
            chatIdsWithConnectionFeed.includes(chatId)
        );
        if (chatIds.length === 0) {
            return res.json({ success: true, chats: [] });
        }
        const chatDetails = await Chats.findAll({
            where: { chat_id: { [Op.in]: chatIds } },
            attributes: ['chat_id', 'title', 'created_at', 'updated_at'],
            order: [['updated_at', 'DESC']] 
        });
        return res.status(200).json({ success: true, chats: chatDetails });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_connection/:connectionName', authenticateCheck, async (req, res) => {
    //Finds individual connection based on name from url
    try {
        const connectionName = req.params.connectionName;
        const connectionFeed = await Feeds.findOne({
            where: { feed_name: connectionName },
            attributes: feedAttributes
        });
        if (!connectionFeed) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }
        return res.status(200).json({ success: true, connection: connectionFeed });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.get('/get_connections/:feedId', authenticateCheck, async (req, res) => {
    //Full list of connections for connection page
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
            order: [['created_at', 'ASC']],
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

router.get('/unread_messages_count/:feed_id', async (req, res) => {
    try {
        const { feed_id } = req.params;
        const feedChats = await FeedChats.findAll({
            where: { feed_id },
            attributes: ['chat_id']
        });
        const chatIds = feedChats.map(fc => fc.chat_id);
        const totalCount = await Messages.count({
            where: {
                is_read: false,
                receiver_id: feed_id,
                chat_id: chatIds
            }
        });
        const chatCounts = await Messages.findAll({
            attributes: [
                'chat_id',
                [sequelize.fn('COUNT', sequelize.col('message_id')), 'unread_count']
            ],
            where: {
                is_read: false,
                receiver_id: feed_id,
                chat_id: chatIds
            },
            group: ['chat_id']
        });
        const feedChatMappings = await FeedChats.findAll({
            where: { chat_id: chatIds },
            attributes: ['chat_id', 'feed_id']
        });
        const chatIdToUnreadCount = chatCounts.reduce((acc, curr) => {
            acc[curr.chat_id] = parseInt(curr.get('unread_count'));
            return acc;
        }, {});
        const feedIdToUnreadCount = feedChatMappings.reduce((acc, mapping) => {
            const { feed_id, chat_id } = mapping;
            if (!acc[feed_id]) acc[feed_id] = 0;
            acc[feed_id] += chatIdToUnreadCount[chat_id] || 0;
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            total: totalCount,
            feedCounts: feedIdToUnreadCount,
            chatCounts: chatIdToUnreadCount 
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, error: 'Failed to get unread counts' });
    }
});

export const directMessagesSocket = (socket) => {
    try {
        socket.on('join_chat', (chat_id) => {
            socket.join(chat_id);
        });
        socket.on('leave_chat', (chat_id) => {
            socket.leave(chat_id);
        });
        socket.on('delete_direct_message', async (data) => {
            const { message_id, channel_id } = data;
            await Messages.destroy({ where: { message_id } });
            socket.to(channel_id).emit('delete_direct_message', { message_id });
        });
        socket.on('send_direct_message', async (message) => {
            const messageLength = message.content.length;
            if (messageLength === 0) {
                socket.emit('error_message', { error: "Message too short" });
                return;
            } else if (messageLength > 1000) {
                socket.emit('error_message', { error: "Message too long" });
                return;
            }
            const newMessage = await Messages.create({
                message_id: message.message_id,
                content: message.content,
                chat_id: message.channel_id,
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
                is_read: false,
                timestamp: message.timestamp
            });
            await Chats.update(
                { updated_at: message.timestamp || new Date() },  
                { where: { chat_id: message.channel_id } }
            );
            socket.to(message.chat_id).emit('chat_message_confirmed', newMessage); 
        });
        socket.on('mark_messages_read', async (data) => {
            const { chat_id, reader_id } = data;
            await Messages.update(
                { is_read: true },
                { 
                    where: { 
                        chat_id,
                        receiver_id: reader_id, 
                        is_read: false 
                    } 
                }
            );
            //).then(([affectedRows]) => {
                //console.log(`${affectedRows} messages marked as read`);
            //});
            socket.to(chat_id).emit('messages_marked_read', { chat_id, reader_id });
        });
    } catch (error) {
        console.log("Socket error:", error);
    }
};

export default router;
