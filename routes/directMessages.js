import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { Chats, Connections, ConnectRequests, FeedChats, FeedChannels, Feeds, Messages, Posts, PostNotes, PostVotes, SavedPosts } from '../models/relationships.js';
import { decrypt, encrypt } from '../functions/encryptionUtil.js';
import dotenv from 'dotenv';
import { Op, Sequelize } from 'sequelize';
import { Router } from 'express';
import sequelize from '../databaseSetup.js';
import { ValidateTextInput } from '../functions/validateTextInput.js';
import { v4 } from 'uuid';

dotenv.config();
const router = Router();

router.post('/accept_connect_request', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { receiverId, senderId } = req.body;
        const connectRequest = await ConnectRequests.findOne({
            where: { receiver_id: receiverId, sender_id: senderId },
            transaction
        });
        await Connections.create({
            connection_id: v4(),
            feed1_id: senderId,
            feed2_id: receiverId,
            connection_date: new Date()
        }, { transaction });
        const encryptedTitle = encrypt("Main");
        const chat = await Chats.create({ 
            chat_id: v4(),
            title: encryptedTitle
        }, { transaction });
        await FeedChats.bulkCreate([
            { feed_id: senderId, chat_id: chat.chat_id },
            { feed_id: receiverId, chat_id: chat.chat_id }
        ], { transaction });
        		await Feeds.increment('connections', {
			where: { feed_id: senderId },
			transaction
		});
		await Feeds.increment('connections', {
			where: { feed_id: receiverId },
			transaction
		});
		await Feeds.decrement('connect_requests', {
			where: { feed_id: receiverId },
			transaction
		});
		await connectRequest.destroy({ transaction });
		await transaction.commit();
        res.status(200).json({ isConnected: true, success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), '/accept_connect_request error:', error);
        res.status(500).json({ isConnected: false, success: false, message: 'Error accepting request' });
    }
});

router.post('/change_chat_name', authenticateCheck, async (req, res) => {
    try {
        const { channelId, newChannelName } = req.body;
        const encryptedTitle = encrypt(newChannelName);
        await Chats.update(
            { title: encryptedTitle },
            { where: { chat_id: channelId } }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/change_chat_name error:', error);
        res.status(500).json({ success: false });
    }
});

router.post('/create_chat', authenticateCheck, async (req, res) => {
    try {
        const { participants, title } = req.body; 
        if (title.length === 0) {
            res.status(403).json({ success: false, message: 'Title cannot be empty' });
        }
        const encryptedTitle = encrypt(title);
        const newChat = await Chats.create({
            chat_id: v4(),
            title: encryptedTitle
        });
        const feedChats = participants.map(participant => ({
            feed_id: participant.feed_id,
            chat_id: newChat.chat_id,
        }));
        await FeedChats.bulkCreate(feedChats);
        res.status(201).json({ success: true, newChat: { ...newChat.toJSON(), title } });
    } catch (error) {
        console.error(new Date().toISOString(), '/create_chat error:', error);
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_chat', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { channelId } = req.body;
        await Messages.destroy({ where: { chat_id: channelId }, transaction });
        await FeedChats.destroy({ where: { chat_id: channelId }, transaction });
        await Chats.destroy({ where: { chat_id: channelId }, transaction });
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/delete_chat error:', error);
        if (transaction) await transaction.rollback();
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_connect_request', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { receiverId, senderId } = req.body;
        await ConnectRequests.destroy({
            where: { sender_id: senderId, receiver_id: receiverId },
            transaction
        });
        await Feeds.decrement('connect_requests', {
			where: { feed_id: receiverId },
			transaction
		});
		await transaction.commit();
        res.status(200).json({ isConnected: false, success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), '/delete_connect_request error:', error);
        res.status(500).json({ isConnected: false,  success: false, message: 'Error deleting request' });
    }
});

router.delete('/delete_connection', authenticateCheck, async (req, res) => { 
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { deleterId, feedId } = req.body;
        await Connections.destroy({
            where: { 
                [Op.or]: [
                    { feed1_id: deleterId, feed2_id: feedId },
                    { feed1_id: feedId, feed2_id: deleterId },
                ]
            }, transaction
        });
        const sharedChats = await FeedChats.findAll({
            attributes: ['chat_id'],
            group: ['chat_id'],
            having: sequelize.literal('COUNT(DISTINCT feed_id) = 2'),
            where: {
                feed_id: {
                    [Op.in]: [deleterId, feedId]
                }
            }, transaction
        });
        const chatIds = sharedChats.map(chat => chat.chat_id);
        if (chatIds.length > 0) {
            await FeedChats.destroy({ where: { chat_id: chatIds }, transaction });
            await Messages.destroy({ where: { chat_id: chatIds }, transaction });
            await Chats.destroy({ where: { chat_id: chatIds }, transaction });
        };
        await Feeds.decrement('connections', {
            where: { feed_id: { [Op.in]: [deleterId, feedId] } },
            transaction
        })
        await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/delete_connection error:', error);
        if (transaction) await transaction.rollback();
        res.status(500).json({ success: false, message: 'Error removing connection' });
    }
});

router.get('/get_chat_messages', authenticateCheck, async (req, res) => {
    try {
        const { channelId, limit, offset } = req.query;
        const viewerId = req.session.viewer_id;
        const messages = await Messages.findAll({
            where: { chat_id: channelId },
            include: [
                { model: Feeds },
                {
                    model: Posts,
                    as: 'sharedPost',
                    required: false,
                    include: [
                        { model: PostNotes, as: 'note', required: false },
                        { model: Feeds, as: 'poster' },
                        {
                            model: FeedChannels,
                            as: 'parentChannel',
                            include: [{ model: Feeds }]
                        },
                        {
                            model: PostVotes,
                            as: 'votes',
                            attributes: ['upvotes', 'downvotes']
                        }
                    ]
                }
            ],
            order: [['created_at', 'ASC']],
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
        });
        const decryptedMessages = messages.map(message => {
            const messageData = message.toJSON();
            messageData.content = decrypt(messageData.content);
            return messageData;
        });
        for (const message of decryptedMessages) {
            if (message.sharedPost) {
                const voteRow = await PostVotes.findOne({
                    where: { post_id: message.shared_post_id, voter_id: viewerId },
                    raw: true
                });
                message.sharedPost.has_upvoted = voteRow?.upvotes > 0 || false;
                message.sharedPost.has_downvoted = voteRow?.downvotes > 0 || false;
                const savedRow = await SavedPosts.findOne({
                    where: { post_id: message.shared_post_id, saver_id: viewerId }
                });
                message.sharedPost.is_saved = !!savedRow;
            }
        }
        res.status(200).json({ messages: decryptedMessages, success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_chat_messages error:', error);
        res.status(500).json({ success: false });
    }
});

router.get('/get_chats/:feedId', authenticateCheck, async (req, res) => {
    try {
        const viewerFeedId = req.params.feedId;
        const { connectionName } = req.query;
        const connectionFeed = await Feeds.findOne({
            where: { feed_name: connectionName },
        });
        if (!connectionFeed) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }
        const connectionFeedId = connectionFeed.feed_id;
        const sharedChats = await FeedChats.findAll({
            where: { feed_id: { [Op.in]: [viewerFeedId, connectionFeedId] } },
            attributes: ['chat_id'],
            group: ['chat_id'],
            having: sequelize.literal('COUNT(DISTINCT feed_id) = 2')
        });
        const chatIds = sharedChats.map(chat => chat.chat_id);
        if (!chatIds.length) {
            return res.status(200).json({ success: true, chats: [] });
        }
        const chatDetails = await Chats.findAll({
            where: { chat_id: { [Op.in]: chatIds } },
            attributes: ['chat_id', 'title', 'created_at', 'updated_at'],
            order: [['updated_at', 'DESC']]
        });
        const decryptedChats = chatDetails.map(chat => ({
            ...chat.toJSON(),
            title: decrypt(chat.title)
        }));
        return res.status(200).json({ success: true, chats: decryptedChats });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_chats error:', error);
        res.status(500).json({ success: false });
    }
});

router.get('/get_connection/:connectionName', authenticateCheck, async (req, res) => {
    //Finds individual connection based on name from url
    try {
        const connectionName = req.params.connectionName;
        const connectionFeed = await Feeds.findOne({
            where: { feed_name: connectionName },
        });
        if (!connectionFeed) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }
        return res.status(200).json({ success: true, connection: connectionFeed });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_connection error:', error);
        res.status(500).json({ success: false, message: 'Error getting connection' });
    }
});

router.get('/get_connections', authenticateCheck, async (req, res) => {
    //Full list of connections for connection page
    try {
        const { feedId, limit, offset } = req.query;
        const parsedOffset = parseInt(offset) || 0;
        const feed = await Feeds.findOne({ where: { feed_id: feedId } });
        if (!feed) { 
            return res.status(404).json({ success: false, message: 'Feed not found' }) 
        }
        const connections = await Connections.findAll({
            include: [{
                model: Feeds,
                as: 'Feed1',
            }, {
                model: Feeds,
                as: 'Feed2',
            }],
            where: {
                [Op.or]: [
                    { feed1_id: feedId },
                    { feed2_id: feedId }
                ]
            },
            limit: parseInt(limit) || 100,
            offset: parsedOffset,
            //More recent connections are first
            order: [['created_at', 'ASC']],
        });
        const filteredConnections = connections.map(connection => {
            const otherFeed = connection.feed1_id === feedId ? connection.Feed2 : connection.Feed1;
            return {
                ...otherFeed.toJSON(),   //Return other feed's details
                connection_id: connection.connection_id,
                connection_date: connection.connection_date
            };
        });
        res.status(200).json({ connections: filteredConnections , success: true });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_connections error:', error);
        res.status(500).json({ success: false, message: 'Error getting connections' });  
    }
});

router.get('/get_connect_requests', authenticateCheck, async (req, res) => {
    try {
        const { feedId, limit, offset } = req.query;
        const parsedOffset = parseInt(offset) || 0;
        const requests = await ConnectRequests.findAll({ 
            where: { receiver_id: feedId },
            attributes: {
                include: [[Sequelize.col('sender.feed_id'), 'feed_id']], //So matches connect button data format
            },
            include: [{
                model: Feeds, 
                as: 'sender',
                required: true,
            }],
            limit: parseInt(limit) || 100,
            offset: parsedOffset
        });
        res.status(200).json({ success: true, requests });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_connect_requests error:', error);
        res.status(500).json({ success: false, message: 'Error getting requests' });
    }
});

router.post('/send_connect_request', authenticateCheck, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { receiverId, senderId } = req.body;
        await ConnectRequests.create({
            request_id: v4(),
            sender_id: senderId,
            receiver_id: receiverId
        }, { transaction });
        await Feeds.increment('connect_requests', {
			where: { feed_id: receiverId },
			transaction
		});
		await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
        if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), '/send_connect_request error:', error);
        res.status(500).json({ success: false, message: 'Error sending request' });
    }
});

router.post('/send_shared_post', authenticateCheck, async (req, res) => {
    try {
        const { post_id, shares, sender_id, message_text } = req.body;
        if (!post_id || !shares || !Array.isArray(shares) || shares.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid request parameters' });
        }
        if (message_text) {
            const validation = ValidateTextInput(message_text, 0, 1000, false);
            if (!validation.valid) {
                return res.status(400).json({ success: false, message: validation.error });
            }
        }
        const post = await Posts.findOne({
            where: { post_id },
            include: [
                { model: PostNotes, as: 'note', required: false },
                { model: Feeds, as: 'poster' },
                {
                    model: FeedChannels,
                    as: 'parentChannel',
                    include: [{ model: Feeds }]
                },
                {
                    model: PostVotes,
                    as: 'votes',
                    attributes: ['upvotes', 'downvotes']
                }
            ]
        });
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        if (post.is_private) {
            return res.status(403).json({ success: false, message: 'Cannot share private posts' });
        }
        const encryptedContent = message_text ? encrypt(message_text) : null;
        let sentCount = 0;
        for (const share of shares) {
            const { chat_id, receiver_id } = share;
            const connection = await Connections.findOne({
                where: {
                    [Op.or]: [
                        { feed1_id: sender_id, feed2_id: receiver_id },
                        { feed1_id: receiver_id, feed2_id: sender_id }
                    ]
                }
            });
            if (!connection) {
                continue;
            }
            const message = await Messages.create({
                message_id: v4(),
                content: encryptedContent,
                chat_id,
                sender_id,
                receiver_id,
                shared_post_id: post_id,
                is_read: false,
                created_at: new Date()
            });
            await Chats.update(
                { updated_at: new Date() },
                { where: { chat_id } }
            );
            const messageWithPost = await Messages.findOne({
                where: { message_id: message.message_id },
                include: [{
                    model: Posts,
                    as: 'sharedPost',
                    required: false,
                    include: [
                        { model: PostNotes, as: 'note', required: false },
                        { model: Feeds, as: 'poster' },
                        {
                            model: FeedChannels,
                            as: 'parentChannel',
                            include: [{ model: Feeds }]
                        },
                        {
                            model: PostVotes,
                            as: 'votes',
                            attributes: ['upvotes', 'downvotes']
                        }
                    ]
                }]
            });
            const messageToSend = messageWithPost.toJSON();
            messageToSend.content = decrypt(messageToSend.content);
            if (messageToSend.sharedPost) {
                const voteRow = await PostVotes.findOne({
                    where: { post_id, voter_id: receiver_id },
                    raw: true
                });
                messageToSend.sharedPost.has_upvoted = voteRow?.upvotes > 0 || false;
                messageToSend.sharedPost.has_downvoted = voteRow?.downvotes > 0 || false;
                const savedRow = await SavedPosts.findOne({
                    where: { post_id, saver_id: receiver_id }
                });
                messageToSend.sharedPost.is_saved = !!savedRow;
            }
            const io = req.app.get('io');
            if (io) {
                io.to(chat_id).emit('chat_message_confirmed', messageToSend);
            }
            sentCount++;
        }
        res.status(200).json({ success: true, sentCount });
    } catch (error) {
        console.error(new Date().toISOString(), '/send_shared_post error:', error);
        res.status(500).json({ success: false, message: 'Error sending shared post' });
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
        const requestCount = await ConnectRequests.count({
            where: { receiver_id: feed_id }
        });
        res.status(200).json({
            success: true,
            total: totalCount,
            feedCounts: feedIdToUnreadCount,
            chatCounts: chatIdToUnreadCount,
            requestCount: requestCount
        });
    } catch (error) {
        console.error(new Date().toISOString(), '/unread_messages_count error:', error);
        res.status(500).json({ success: false, message: 'Failed to get unread counts' });
    }
});

export const connectRequestsSocket = (socket) => {
    try {
        socket.on('send_connect_request', async (data) => {
            const { senderId, receiverId } = data;
            try {
                await ConnectRequests.create({
                    sender_id: senderId,
                    receiver_id: receiverId,
                    created_at: new Date()
                });
                socket.to(receiverId.toString()).emit('new_connect_request', { 
                    sender_id: senderId 
                });
            } catch (error) {
                socket.emit('error_message', { error: 'Failed to send connect request' });
            }
        });
        socket.on('resolve_connect_request', async (data) => {
            const { senderId, receiverId, accepted } = data;
            try {
                await ConnectRequests.destroy({ 
                    where: { 
                        sender_id: senderId, 
                        receiver_id: receiverId 
                    } 
                });
                socket.to(receiverId.toString()).emit('connect_request_resolved', { 
                    count: 1,
                    accepted
                });
                socket.to(senderId.toString()).emit('connect_request_response', {
                    receiverId,
                    accepted
                });
            } catch (error) {
                socket.emit('error_message', { error: 'Failed to resolve connect request' });
            }
        });
    } catch (error) {
        console.error(new Date().toISOString(), 'Connect requests socket error:', error);
    }
};

export const directMessagesSocket = (socket) => {
    try {
        socket.on('join_chat', (chat_id) => {
            socket.join(chat_id);
        });
        socket.on('leave_chat', (chat_id) => {
            socket.leave(chat_id);
        });
        socket.on('chat_created', (data) => {
            const { chat, connection_feed_id } = data;
            if (connection_feed_id) {
                socket.to(connection_feed_id.toString()).emit('new_chat_created', { chat });
            }
        });
        socket.on('chat_deleted', async (data) => {
            const { chat_id, connection_feed_id } = data;
            socket.to(connection_feed_id.toString()).emit('chat_removed', { chat_id });
        });
        socket.on('chat_renamed', async (data) => {
            const { chat_id, new_title, connection_feed_id } = data;
            socket.to(connection_feed_id.toString()).emit('chat_name_changed', { 
                chat_id, 
                new_title 
            });
        });
        socket.on('delete_direct_message', async (data) => {
            try {
                const { message_id, channel_id } = data;
                await Messages.destroy({ where: { message_id: data.message_id } });
                socket.to(channel_id).emit('delete_direct_message', { message_id });
            } catch (error) {
                console.error('delete_direct_message error:', error);
                socket.emit('error_message', { error: 'Failed to delete message' });
            }
        });
        socket.on('edit_direct_message', async (data) => {
            try {
                const { message_id, content, channel_id } = data;
                const validation = ValidateTextInput(content, 1, 1000);
                if (!validation.valid) {
                    socket.emit('error_message', { error: validation.error });
                    return;
                }
                const encryptedContent = encrypt(content);
                await Messages.update(
                    { content: encryptedContent, edited_at: new Date() },
                    { where: { message_id } }
                );
                const updatedMessage = await Messages.findOne({ where: { message_id } });
                const messageToSend = {
                    ...updatedMessage.toJSON(),
                    content: content
                };
                socket.to(channel_id).emit('message_edited', messageToSend);
                socket.emit('message_edited', messageToSend);
            } catch (error) {
                console.error('edit_direct_message error:', error);
                socket.emit('error_message', { error: 'Failed to edit message' });
            }
        });
        socket.on('send_direct_message', async (message) => {
            try {
                const validation = ValidateTextInput(message.content, 1, 1000);
                if (!validation.valid) {
                    socket.emit('error_message', { error: validation.error });
                    return;
                }
                const encryptedContent = encrypt(message.content);
                const newMessage = await Messages.create({
                    message_id: message.message_id,
                    content: encryptedContent,
                    chat_id: message.channel_id,
                    sender_id: message.sender_id,
                    receiver_id: message.receiver_id,
                    is_read: false,
                    created_at: message.created_at
                });
                await Chats.update(
                    { updated_at: message.created_at || new Date() },
                    { where: { chat_id: message.channel_id } }
                );
                const messageToSend = {
                    ...newMessage.toJSON(),
                    content: message.content
                };
                socket.to(message.channel_id).emit('chat_message_confirmed', messageToSend);
                socket.emit('chat_message_confirmed', messageToSend);
            } catch (error) {
                console.error('send_direct_message error:', error);
                socket.emit('message_send_failed', {
                    message_id: message.message_id,
                    error: 'Failed to send message'
                });
            }
        });
        socket.on('mark_messages_read', async (data) => {
            try {
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
                socket.to(chat_id).emit('messages_marked_read', { chat_id, reader_id });
            } catch (error) {
                console.error('mark_messages_read error:', error);
            }
        });
    } catch (error) {
        console.error(new Date().toISOString(), 'Socket error:', error);
    }
};

export default router;