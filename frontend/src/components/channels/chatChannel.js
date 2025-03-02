import axios from 'axios';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../authContext';
import { io } from "socket.io-client";
import { v4 } from 'uuid';
import { decrypt, encrypt } from '../../encryptionUtil';
import Message from '../connections/message';
import { UnreadContext } from '../connections/unreadContext';

const ChatChannel = ({ canRemove, channelId, connection, isGroup, setChats, setErrorMessage }) => {
    const [channel, setChannel] = useState([]);
    const { dispatch } = useContext(UnreadContext);
    const [hasMore, setHasMore] = useState(true);
    const [message, setMessage] = useState('');
    const [offset, setOffset] = useState(0);
    const { user, viewer } = useContext(AuthContext);
    const maxLength = user.has_membership ? 100000 : 1000;
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (channelId && !isGroup && viewer.feed_id) {
            try {
                socketRef.current.emit('mark_messages_read', {
                    chat_id: channelId,
                    reader_id: viewer.feed_id,
                });
                dispatch({ chatId: channelId, type: 'MARK_AS_READ' });
            } catch (error) {
                setErrorMessage('Error marking messages as read');
            }
        }
    }, [channelId, isGroup, viewer.feed_id, dispatch]);
    
    //Fetch and listen for messages
    useEffect(() => {
        const socket = io(process.env.REACT_APP_SOCKET_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: true
        });
        console.log(process.env.REACT_APP_SOCKET_URL);
        console.log("socket:", socket);
        socket.on('connect', () => console.log('Socket connected successfully'));
        socket.on('connect_error', (err) => {
            console.error('Connection Error details:', err);
            setErrorMessage(`Connection failed`);
        });
        socketRef.current = socket;
        const channelRoute = isGroup ? 'join_channel' : 'join_chat';
        const leaveRoute = isGroup ? 'leave_channel' : 'leave_chat';
        const confirmedRoute = isGroup ? 'channel_message_confirmed' : 'chat_message_confirmed';
        const deleteRoute = isGroup ? 'delete_feed_message' : 'delete_direct_message';
        if (channelId) {
            socket.emit(channelRoute, channelId);
            getChannelMessages(channelId);
            const handleNewMessage = (newMessage) => {
                if (newMessage.channel_id === channelId) {
                    const processedMessage = {
                        ...newMessage,
                        content: isGroup ? newMessage.content : decrypt(newMessage.content),
                    };
                    setChannel((prevMessages) => [...prevMessages, processedMessage]);
                }
            };
            const handleConfirmedMessage = (confirmedMessage) => {
                const processedMessage = {
                    ...confirmedMessage,
                    content: isGroup ? confirmedMessage.content : decrypt(confirmedMessage.content),
                };
                setChannel((prevMessages) => [...prevMessages, processedMessage]);
            };
            const handleMessagesRead = ({ chat_id, reader_id }) => {
                if (chat_id === channelId) {
                    setChannel((prevMessages) =>
                        prevMessages.map(msg =>
                            (msg.sender_id !== reader_id && !msg.is_read)
                                ? { ...msg, is_read: true }
                                : msg
                        )
                    );
                }
            };            
            socket.on('new_message', handleNewMessage);
            socket.on(confirmedRoute, handleConfirmedMessage);
            socket.on(deleteRoute, deleteMessage);
            socket.on('messages_marked_read', handleMessagesRead);
            socket.on('error_message', (error) => setErrorMessage(error?.error || 'An error occurred'));
            socket.on('connect_error', (err) => console.log('Connection Error:', err));
            return () => {
                socket.emit(leaveRoute, channelId);
                socket.off('new_message', handleNewMessage);
                socket.off(confirmedRoute, handleConfirmedMessage);
                socket.off(deleteRoute, deleteMessage);
                socket.off('messages_marked_read', handleMessagesRead);
                socket.off('error_message');
                socket.disconnect();
            };
        }
    }, [channelId, deleteMessage, isGroup, setErrorMessage, viewer.feed_id]);
    
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [channel]);

    const deleteMessage = useCallback((messageId) => {
        try {
            if (!messageId) return;
            const route = isGroup ? 'delete_feed_message' : 'delete_direct_message';
            socketRef.current.emit(route, {
                message_id: messageId,
                channel_id: channelId,
            });
            setChannel(prev => prev.filter(m => m.message_id !== messageId));  
        } catch (error) {
            setErrorMessage("Error deleting message");
        }
    }, [channelId, dispatch, isGroup, viewer.feed_id]);

    const getChannelMessages = useCallback(async (channelId, currentOffset = 0) => {
        try {
            const route = isGroup ? 'feed_channel_messages' : 'get_chat_messages';
            const response = await axios.get(`/api/${route}`, { params: { channelId, limit: 20, offset: currentOffset } });
            const messages = response.data.messages.map((m) => ({
                ...m,
                content: isGroup ? m.content : decrypt(m.content),
            }));
            if (messages.length < 20) setHasMore(false);
            if (currentOffset === 0) setChannel(messages);
            else setChannel(prev => [...messages, ...prev]);
            setOffset(currentOffset + messages.length);
        } catch (error) {
            setErrorMessage('Error fetching messages');
        }
    }, [isGroup, setErrorMessage]);

    useEffect(() => {
        if (channelId) {
            setChannel([]);
            setOffset(0);
            setHasMore(true);
            getChannelMessages(channelId, 0);
        }
    }, [channelId, getChannelMessages]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (container.scrollTop === 0 && hasMore) {
                getChannelMessages(channelId, offset);
            }
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [channelId, getChannelMessages, hasMore, offset]);

    const sendMessage = useCallback(() => {
        try {
            if (!message.trim()) return;
            if (message.length > maxLength) {
                setErrorMessage(`Message cannot exceed ${maxLength} characters.`);
                return;
            };
            const newMessage = {
                message_id: v4(),
                content: isGroup ? message : encrypt(message),
                sender_id: viewer.feed_id,
                receiver_id: isGroup ? null: connection.feed_id,
                channel_id: channelId,
                timestamp: Date.now(),
            };
            const route = isGroup ? 'send_feed_message' : 'send_direct_message';
            socketRef.current.emit(route, newMessage);
            const displayedMessage = { ...newMessage, content: message }; //Prevents displaying ciphertext
            setChannel((prev) => [...prev, displayedMessage]);
            if (!isGroup) {
                setChats((prevChats) => { //Moves current chat to top of chat list
                    const updatedChats = prevChats.map((chat) => 
                        chat.chat_id === channelId
                            ? {...chat, updated_at: new Date().toISOString() }
                            : chat
                    );
                    return updatedChats.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                });
            }
            setMessage('');
        } catch (error) {
            setErrorMessage("Error sending message");
        }
    }, [channelId, isGroup, maxLength, message, setChats, setErrorMessage, viewer.feed_id]);

    return (
        <div className="messages-section">
            <div className="messages-list-container" ref={messagesContainerRef}>
                {channel.map((msg, index) => (
                    <Message
                        key={msg.message_id || index}
                        canRemove={canRemove}
                        deleteMessage={deleteMessage}
                        isGroup={isGroup}
                        isOutgoing={msg.sender_id === viewer.feed_id}
                        isRead={msg.is_read}
                        message={msg}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="messages-channel-footer">
                <input
                    className="chat-message-bar"
                    type="text"
                    value={message}
                    placeholder="Type a message..."
                    onChange={(e) => {
                        if (e.target.value.length > maxLength) {
                            setErrorMessage(`Message cannot exceed ${maxLength} characters.`);
                            return;
                        }
                        setErrorMessage('');
                        setMessage(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button className="chat-send-button" onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
}

export default ChatChannel;