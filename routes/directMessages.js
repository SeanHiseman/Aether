import { Router } from 'express';
import { v4 } from 'uuid';
import { Op } from 'sequelize';
import { Chats, Friends, Profiles, UserChats, Users, Messages } from '../models/models.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';

const router = Router();

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
        const userChats = participants.map(userId => ({
            user_id: userId,
            chat_id: newChat.chat_id,
        }));
        await UserChats.bulkCreate(userChats);
        res.status(201).json(newChat);
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

router.delete('/delete_chat', authenticateCheck, async (req, res) => {
    try {
        const { chat_id, title } = req.body;
        //Main channels are default, so can't be deleted
        if (title === 'Main') {
            res.status(403).json({ message: 'Main chats cannot be deleted' });
        } else {
            await UserChats.destroy({
                where: { 
                    chat_id
                },
            });
            await Chats.destroy({
                where: { 
                    chat_id
                },
            });
            res.status(200).json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

//Get messages for specific user chat
router.get('/get_chat_messages/:chat_id', authenticateCheck, async (req, res) => {
    try {
        const chatId = req.params.chat_id;
        const messages = await Messages.findAll({
            where: { chat_id: chatId },
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
        res.status(500).json({ success: false });
    }
});

//Get all chats for logged in user
router.get('/get_chats', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session.user_id;
        //Chat ID's that user is a part of
        const userChatIds = await UserChats.findAll({
            where: { user_id: userId },
            attributes: ['chat_id'],
        });
        const chatIds = userChatIds.map(uc => uc.chat_id);
        const chats = await Chats.findAll({
            where: { chat_id: chatIds },
            include: [{
                model: Users,
                as: 'users',
                attributes: ['user_id', 'username'],
                through: { attributes: [] },
                required: false
            }],
            order: [['updated_at', 'ASC']]
        });
        const chatsData = chats.map(chat => {
            const participants = chat.users.map(user => ({
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
        res.status(500).json({ success: false });  
    }
});

//Socket.io event for sending message to an individual user
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
        console.log("Socket error:", error);
    }
};

export default router;
