import { Router } from 'express';
import { v4 } from 'uuid';
import { Op } from 'sequelize';
import { Conversations, Friends, UserConversations, Users, Messages } from '../models/models.js';

const router = Router();

//Get Friends
router.get('/get_friends', async (req, res) => {
    const userId = req.session.user_id;
    const user = await Users.findOne({ where: { user_id: userId } });

    //Get friends for user
    const friendships = await Friends.findAll({
        where: {
            [Op.or]: [
                { user1_id: user.user_id },
                { user2_id: user.user_id }
            ]
        },
        order: [['FriendSince', 'ASC']]
    });

    //Get friend data
    const friendsData = await Promise.all(friendships.map(async (friendship) => {
        const friendId = (friendship.user1_id !== user.user_id) ? friendship.user1_id : friendship.user2_id;
        const friend = await Users.findByPk(friendId);
        const conversation = await UserConversations.findOne({
            where: {
                user_id: {
                    [Op.in]: [user.user_id, friendId]
                }
            },
            include: [Conversations]
        });

        return {
            friend_id: friend.user_id,
            friend_name: friend.username,
            conversation_id: conversation ? conversation.conversation_id: null
        };
    }));

    res.json(friendsData);
});

//Get Chat Messages
router.get('/get_chat_messages/:conversation_id', async (req, res) => {
    const userId = req.session.user_id;
    const user = await Users.findOne({ where: { user_id: userId } });
    const conversationId = req.params.conversation_id;

    const userConversation = await UserConversations.findOne({
        where: {
            user_id: user.user_id,
            conversation_id: conversationId
        }
    });

    if (!userConversation) {
        return res.status(403).json({ error: "Conversation not found" });
    }

    const messages = await Messages.findAll({
        where: { conversation_id: conversationId },
        order: [['timestamp', 'ASC']]
    });

    const messagesData = messages.map(m => ({
        senderId: m.sender_id,
        content: m.message_content,
        timestamp: m.timestamp
    }));

    res.json(messagesData);
});

//Socket.io event for sending Message
export const directMessagesSocket = (socket) => {
    socket.on('send_message', async (message) => {
        const messageLength = message.content.length;
        if (messageLength === 0) {
            socket.emit('error_message', { error: "Message too short" });
            return;
        } else if (messageLength > 1000) {
            socket.emit('error_message', { error: "Message too long" });
            return;
        }

        const newMessage = await Messages.create({
            message_id: v4(),
            conversation_id: message.conversationId,
            sender_id: message.senderId,
            message_content: message.content,
            timestamp: new Date()
        });

        emit('message_confirmed', message); //Broadcasting the message
    });
};

export default router;
