import axios from 'axios';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../authContext';
import { io } from "socket.io-client";
import { v4 } from 'uuid';
import { decrypt, encrypt } from '../../encryptionUtil';
import Message from '../connections/message';
import { UnreadContext } from '../connections/unreadContext';

const ChatChannel = ({ canAdd, canRemove, channelId, connection, isGroup, isLocked, setChats, setErrorMessage }) => {
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

    //Initialize socket connection once
    useEffect(() => {
        if (!socketRef.current) {
            socketRef.current = io(process.env.REACT_APP_SOCKET_URL, {
                transports: ['websocket', 'polling'],
            });
            socketRef.current.on('connect_error', (err) => {
                setErrorMessage(`Connection failed`);
            });
            socketRef.current.on('error_message', (error) => 
                setErrorMessage('An error occurred'));
        }
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []); 

    //Mark messages as read when entering a channel
    useEffect(() => {
        if (channelId && !isGroup && viewer.feed_id && socketRef.current && socketRef.current.connected) {
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
    }, [channelId, isGroup, viewer.feed_id, dispatch, socketRef.current?.connected]);
    
    //Channel-specific setup and event listeners
    useEffect(() => {
        try {
            const socket = socketRef.current;
            if (!socket || !channelId) {
                console.warn("Socket or channelId is missing");
                return;
            }
            const channelRoute = isGroup ? 'join_channel' : 'join_chat';
            const leaveRoute = isGroup ? 'leave_channel' : 'leave_chat';
            const confirmedRoute = isGroup ? 'channel_message_confirmed' : 'chat_message_confirmed';
            const deleteRoute = isGroup ? 'delete_feed_message' : 'delete_direct_message';
            const setupChannel = () => {
                try {
                    console.log(`Joining ${channelRoute} with ID:`, channelId);
                    socket.emit(channelRoute, channelId);
                    getChannelMessages(channelId, 0);
                } catch (error) {
                    console.error("Error setting up channel:", error);
                }
            };
            if (socket.connected) {
                setupChannel();
            } else {
                socket.once('connect', setupChannel);
            }
            const handleNewMessage = (newMessage) => {
                try {
                    if (newMessage.channel_id === channelId) {
                        setChannel((prevMessages) => {
                            const messageExists = prevMessages.some(msg => msg.message_id === newMessage.message_id);
                            if (messageExists) return prevMessages;
                            const processedMessage = {
                                ...newMessage,
                                content: isGroup ? newMessage.content : decrypt(newMessage.content),
                            };
                            return [...prevMessages, processedMessage];
                        });
                    }
                } catch (error) {
                    console.error("Error handling new message:", error, newMessage);
                }
            };
            const handleConfirmedMessage = (confirmedMessage) => {
                try {
                    const processedMessage = {
                        ...confirmedMessage,
                        content: isGroup ? confirmedMessage.content : decrypt(confirmedMessage.content),
                    };
                    setChannel((prevMessages) => [...prevMessages, processedMessage]);
                } catch (error) {
                    console.error("Error handling confirmed message:", error, confirmedMessage);
                }
            };
            const handleMessagesRead = ({ chat_id, reader_id }) => {
                try {
                    if (chat_id === channelId) {
                        setChannel((prevMessages) =>
                            prevMessages.map(msg =>
                                (msg.sender_id !== reader_id && !msg.is_read)
                                    ? { ...msg, is_read: true }
                                    : msg
                            )
                        );
                    }
                } catch (error) {
                    console.error("Error handling messages read:", error);
                }
            };
            try {
                socket.on('new_message', handleNewMessage);
                socket.on(confirmedRoute, handleConfirmedMessage);
                socket.on(deleteRoute, deleteMessage);
                socket.on('messages_marked_read', handleMessagesRead);
            } catch (error) {
                console.error("Error setting up socket listeners:", error);
            }
            return () => {
                try {
                    if (socket.connected) {
                        console.log(`Leaving ${leaveRoute} with ID:`, channelId);
                        socket.emit(leaveRoute, channelId);
                    }
                    socket.off('new_message', handleNewMessage);
                    socket.off(confirmedRoute, handleConfirmedMessage);
                    socket.off(deleteRoute, deleteMessage);
                    socket.off('messages_marked_read', handleMessagesRead);
                } catch (error) {
                    console.error("Error cleaning up socket listeners:", error);
                }
            };
        } catch (error) {
            console.error("Unexpected error in useEffect:", error);
        }
    }, [channelId, isGroup, getChannelMessages, deleteMessage]);    
    
    //Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [channel]);

    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.emit('join_channel_type', isGroup ? 'feed_chat' : 'direct_message');
        }
    }, [isGroup]);

    const deleteMessage = useCallback((messageId) => {
        try {
            if (!messageId || !socketRef.current || !socketRef.current.connected) return;
            const route = isGroup ? 'delete_feed_message' : 'delete_direct_message';
            socketRef.current.emit(route, {
                message_id: messageId,
                channel_id: channelId,
            });
            setChannel(prev => prev.filter(m => m.message_id !== messageId));  
        } catch (error) {
            setErrorMessage("Error deleting message");
        }
    }, [channelId, isGroup, setErrorMessage]);

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

    //Reset channel when channelId changes
    useEffect(() => {
        if (channelId) {
            setChannel([]);
            setOffset(0);
            setHasMore(true);
            getChannelMessages(channelId, 0);
        }
    }, [channelId, getChannelMessages]);

    //Infinite scrolling
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

    //Send message with connection checks
    const sendMessage = useCallback(() => {
        try {
            if (!message.trim()) return;
            if (message.length > maxLength) {
                setErrorMessage(`Message cannot exceed ${maxLength} characters.`);
                return;
            }
            if (!socketRef.current || !socketRef.current.connected) {
                setErrorMessage("Error, please try again.");
                if (socketRef.current) socketRef.current.connect();
                return;
            }
            const newMessage = {
                message_id: v4(),
                content: isGroup ? message : encrypt(message),
                sender_id: viewer.feed_id,
                receiver_id: isGroup ? null: connection.feed_id,
                channel_id: channelId,
                created_at: Date.now(),
            };
            const route = isGroup ? 'send_feed_message' : 'send_direct_message';
            socketRef.current.emit(route, newMessage);
            setMessage('');
        } catch (error) {
            setErrorMessage("Error sending message");
        }
    }, [channelId, isGroup, maxLength, message, setChats, setErrorMessage, viewer.feed_id]);

    return (
        <div className="channel">
            <div className="channel-content" ref={messagesContainerRef}>
                {channel.length > 0 ? (
                    channel.map((msg, index) => (
                        <Message
                            key={msg.message_id || index}
                            canRemove={canRemove}
                            deleteMessage={deleteMessage}
                            isGroup={isGroup}
                            isOutgoing={msg.sender_id === viewer.feed_id}
                            isRead={msg.is_read}
                            message={msg}
                        />
                    ))
                ) : (   
                    <p className="text36">No messages yet</p>
                )}
                <div ref={messagesEndRef} />
            </div>
            {(!isLocked || canAdd) && (
                <div className="messages-channel-footer">
                    <input
                        className="chat-message-bar"
                        type="text"
                        value={message}
                        placeholder="Type a message..."
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= maxLength) {
                                setMessage(input);
                                setErrorMessage('');
                            } else {
                                setErrorMessage(`${maxLength} character limit.`, !user.has_membership && "Get membership for more.");
                            }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button className="chat-send-button" onClick={sendMessage}>Send</button>
                </div>
            )}
        </div>
    );
}

export default ChatChannel;