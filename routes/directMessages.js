import { Router } from 'express';
import { v4 } from 'uuid';
import { Op } from 'sequelize';
import { Conversations, Friends, Profiles, UserConversations, Users, Messages } from '../models/models.js';
import authenticateCheck from '../functions/authenticateCheck.js';

const router = Router();

//Get Friends
router.get('/get_friends', authenticateCheck, async (req, res) => {
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

        const friendProfile = await Profiles.findOne({
            where: {
                user_id: friendId
            }
        });

        return {
            friend_id: friend.user_id,
            friend_name: friend.username,
            friend_profile_photo: friendProfile.profile_photo,
            conversation_id: conversation ? conversation.conversation_id: null
        };
    }));

    res.json(friendsData);
});

//Get chat messages
router.get('/get_chat_messages/:conversation_id', authenticateCheck, async (req, res) => {
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

//Get all conversations for logged in user
router.get('/get_conversations', authenticateCheck, async (req, res) => {
    const userId = req.session.user_id;
    try {
        //Conversation ID's that user is a part of
        const userConversationIds = await UserConversations.findAll({
            where: { user_id: userId },
            attributes: ['conversation_id'],
        });
        
        const conversationIds = userConversationIds.map(uc => uc.conversation_id);

        const conversations = await Conversations.findAll({
            where: { conversation_id: conversationIds },
            include: [{
                model: Users,
                as: 'users',
                attributes: ['user_id', 'username'],
                through: { attributes: [] },
                required: false
            }],
            order: [['updated_at', 'ASC']]
        });

        const conversationsData = conversations.map(conversation => {
            const participants = conversation.users.map(user => ({
                userId: user.user_id,
                username: user.username
            }));
            return {
                conversationId: conversation.conversation_id,
                title: conversation.title,
                participants: participants,
                createdAt: conversation.created_at,
                updatedAt: conversation.updated_at
            };
        });
        res.json(conversationsData);
    } catch (error) {
        console.error("Failed to fetch user conversations:", error);
        res.status(500).json({ error: "Failed to fetch user conversations "});
    }
});

//Socket.io event for sending Message
export const directMessagesSocket = (socket) => {
    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
    });

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

        socket.to(message.conversationId).emit('message_confirmed', {
            ...message,
            message_id: newMessage.message_id,
            timestamp: newMessage.timestamp
        }); 
    });

    socket.on('leave_conversation', (conversationId) => {
        socket.leave(conversationId);
    })
};

export default router;
