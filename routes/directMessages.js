import { Router } from 'express';
import { v4 } from 'uuid';
import { Op } from 'sequelize';
import { Conversations, Friends, Profiles, UserConversations, Users, Messages } from '../models/models.js';
import authenticateCheck from '../functions/authenticateCheck.js';

const router = Router();

//Changes name of chat between users
router.post('/change_chat_name', authenticateCheck, async (req, res) => {
    try {
        const { conversationId, newTitle } = req.body;

        await Conversations.update(
            { title: newTitle },
            { where: { conversation_id: conversationId } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error changing chat name"});
    }
});

//Create new conversation
router.post('/create_conversation', authenticateCheck, async (req, res) => {
    const { participants, title } = req.body;

    if (!participants || participants.length < 2) {
        return res.status(400).json({ message: "Too few participants." });
    }

    try {
        const newConversation = await Conversations.create({
            conversation_id: v4(),
            title: title
        });

        const userConversations = participants.map(userId => ({
            user_id: userId,
            conversation_id: newConversation.conversation_id,
        }));
        await UserConversations.bulkCreate(userConversations);
        res.status(201).json(newConversation);

    } catch (error) {
        res.status(500).json({ message: 'Failed to create conversation' });
    }
});

//Deletes chat
router.delete('/delete_chat', authenticateCheck, async (req, res) => {
    try {
        const { conversation_id, title } = req.body;
        //Main channels are default, so can't be deleted
        if (title === 'Main') {
            res.status(500).json({ message: 'Main chats cannot be deleted' });
        } else {
            await UserConversations.destroy({
                where: { 
                    conversation_id: conversation_id
                },
            });
            await Conversations.destroy({
                where: { 
                    conversation_id: conversation_id
                },
            });
            res.status(200).json({ message: 'Chat deleted successfully '});
        }
    } catch (error) {
        res.status(500).json({ error: 'Error deleting chat' });
    }
});

//Get chat messages
router.get('/get_chat_messages/:conversation_id', authenticateCheck, async (req, res) => {
    try {
        const conversationId = req.params.conversation_id;
        const messages = await Messages.findAll({
            where: { conversation_id: conversationId },
            include: [{
                model: Users,
                attributes: ['user_id'],
                include: [{
                    model: Profiles,
                    attributes: ['profile_photo']
                }]
            }],
            order: [['timestamp', 'ASC']]
        });
        const messagesData = messages.map(m => ({
            message_id: m.message_id, //not messageId since group messages use message_id
            senderId: m.sender_id,
            message_content: m.message_content,
            timestamp: m.timestamp,
            user: {
                profile: {
                    profile_photo: m.user.profile.profile_photo
                }
            }
        }));

        res.json(messagesData);
    } catch (error) {
        res.status(500).send('Error getting chat messages: ', error);
    }
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

//Get Friends
router.get('/get_friends', authenticateCheck, async (req, res) => {
    try {
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
            //More recent friends are first
            order: [['FriendSince', 'ASC']]
        });

        //Get friend data
        const friendsData = await Promise.all(friendships.map(async (friendship) => {
            const friendId = (friendship.user1_id !== user.user_id) ? friendship.user1_id : friendship.user2_id;
            const friend = await Users.findByPk(friendId);

            const friendProfile = await Profiles.findOne({
                where: {
                    user_id: friendId
                }
            });

            return {
                friend_id: friend.user_id,
                friend_profile_id: friendProfile.profile_id,
                friend_name: friend.username,
                friend_profile_photo: friendProfile.profile_photo,
            };
        }));

        res.json(friendsData);
    } catch (error) {
        res.status(500).send('Error getting friends:', error);  
    }
});

//Socket.io event for sending message to an individual user
export const directMessagesSocket = (socket) => {
    try {
        socket.on('join_conversation', (conversationId) => {
            socket.join(conversationId);
        });

        socket.on('leave_conversation', (conversationId) => {
            socket.leave(conversationId);
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
                conversation_id: message.conversationId,
                sender_id: message.senderId,
                message_content: message.message_content,
                timestamp: message.timestamp
            });
            socket.to(message.conversationId).emit('message_confirmed', {
                ...message,
                message_id: newMessage.message_id,
                timestamp: newMessage.timestamp
            }); 
        });
    } catch (error) {
        console.log("Socket error:", error);
    }
};

export default router;
