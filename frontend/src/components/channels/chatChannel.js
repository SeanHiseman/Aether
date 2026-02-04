import api from '../../api';
import { AuthContext } from '../authContext';
import { FaTimes, FaPaperclip } from 'react-icons/fa';
import Message from '../messages/message';
import { UnreadContext } from '../messages/unreadContext';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ValidateTextInput } from '../../functions/validateTextInput';
import { updateChannelView } from '../../functions/channelViewTracking';
import { v4 } from 'uuid';

const ChatChannel = ({ canAdd, canRemove, channelId, connection, isGroup, isLocked, setChats, setErrorMessage }) => {
    const [channel, setChannel] = useState([]);
    const { dispatch } = useContext(UnreadContext);
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [message, setMessage] = useState('');
    const [offset, setOffset] = useState(0);
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const [validationError, setValidationError] = useState('');
    const maxLength = user?.has_membership ? 10000 : 1000;
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const isInitialLoad = useRef(true);
    const [attachedMedia, setAttachedMedia] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const fileInputRef = useRef(null);

    //Use the global socket from SocketProvider
    useEffect(() => {
        if (window.socket) {
            socketRef.current = window.socket;
        } else {
            setErrorMessage('Connection failed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [setErrorMessage]); 

    //Mark messages as read when entering a channel
    const deleteMessage = useCallback((messageId) => {
        try {
            if (!messageId || !socketRef.current || !socketRef.current.connected) return;
            const route = isGroup ? 'delete_feed_message' : 'delete_direct_message';
            socketRef.current.emit(route, {
                message_id: messageId,
                channel_id: channelId,
            });
            setChannel(prev => prev.filter(m => m?.message_id !== messageId));
        } catch (error) {
            setErrorMessage("Error deleting message");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [channelId, isGroup, setErrorMessage]);

    const editMessage = useCallback((messageId, newContent) => {
        try {
            const validation = ValidateTextInput(newContent, 0, maxLength, false);
            if (!validation.valid) {
                setErrorMessage(validation.error);
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            if (!socketRef.current || !socketRef.current.connected) {
                setErrorMessage("Error, please try again.");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            const route = isGroup ? 'edit_feed_message' : 'edit_direct_message';
            socketRef.current.emit(route, {
                message_id: messageId,
                content: newContent,
                channel_id: channelId,
            });
            setEditingMessageId(null);
            setEditContent('');
        } catch (error) {
            setErrorMessage("Error editing message");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [channelId, isGroup, setErrorMessage, maxLength]);

    const getChannelMessages = useCallback(async (channelId, currentOffset = 0) => {
        try {
            const container = messagesContainerRef.current;
            const previousScrollHeight = container?.scrollHeight || 0;
            const route = isGroup ? 'feed_channel_messages' : 'get_chat_messages';
            const limit = 100;
            const response = await api.get(`/${route}`, { 
                params: { channelId, limit, offset: currentOffset }
            });
            const messages = response.data?.messages || [];
            if (messages.length < limit) setHasMore(false);
            if (currentOffset === 0) {
                setChannel(messages);
                isInitialLoad.current = true;
            } else {
                isInitialLoad.current = false;
                setChannel(prev => [...messages, ...prev]);
                //Maintain scroll position after prepending messages
                requestAnimationFrame(() => {
                    if (container) {
                        const newScrollHeight = container.scrollHeight;
                        container.scrollTop = newScrollHeight - previousScrollHeight;
                    }
                });
            }
            setOffset(currentOffset + messages.length);
        } catch (error) {
            setErrorMessage('Error fetching messages');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [isGroup, setErrorMessage]);

    useEffect(() => {
        if (isInitialLoad.current && channel.length > 0) {
            const container = messagesContainerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
            isInitialLoad.current = false;
        }
    }, [channel]);

    useEffect(() => {
        const socket = socketRef.current;
        if (channelId && !isGroup && viewer?.feed_id && socket && socket.connected) {
            try {
                socket.emit('mark_messages_read', {
                    chat_id: channelId,
                    reader_id: viewer?.feed_id,
                });
                dispatch({
                    chatId: channelId,
                    feedId: connection?.feed_id,
                    type: 'MARK_AS_READ'
                });
            } catch (error) {
                setErrorMessage('Error marking messages as read');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        }
    }, [channelId, isGroup, viewer?.feed_id, connection?.feed_id, dispatch, setErrorMessage]);

    //Channel-specific setup and event listeners
    useEffect(() => {
        try {
            const socket = socketRef.current;
            if (!socket || !channelId) {
                return;
            }
            const channelRoute = isGroup ? 'join_channel' : 'join_chat';
            const leaveRoute = isGroup ? 'leave_channel' : 'leave_chat';
            const confirmedRoute = isGroup ? 'channel_message_confirmed' : 'chat_message_confirmed';
            const deleteRoute = isGroup ? 'delete_feed_message' : 'delete_direct_message';
            const setupChannel = () => {
                try {
                    socket.emit(channelRoute, channelId);
                    getChannelMessages(channelId, 0);
                } catch (error) {
                    setErrorMessage("Error setting up channel");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                }
            };
            if (socket.connected) {
                setupChannel();
            } else {
                socket.once('connect', setupChannel);
            }
            const handleNewMessage = (newMessage) => {
                try {
                    if (newMessage?.chat_id === channelId) {
                        setChannel((prevMessages) => {
                            const messageExists = prevMessages.some(msg => msg?.message_id === newMessage?.message_id);
                            if (messageExists) return prevMessages;
                            return [...prevMessages, newMessage];
                        });
                        setTimeout(() => {
                            const container = messagesContainerRef.current;
                            if (container) {
                                container.scrollTop = container.scrollHeight;
                            }
                        }, 0);
                    }
                    //Move chat to top when receiving a message (after Main)
                    if (!isGroup && setChats && newMessage?.chat_id) {
                        setChats(prevChats => {
                            const mainChat = prevChats.find(c => c?.title === 'Main');
                            const targetChat = prevChats.find(c => c?.chat_id === newMessage?.chat_id);
                            const otherChats = prevChats.filter(c => c?.title !== 'Main' && c?.chat_id !== newMessage?.chat_id);
                            
                            if (targetChat) {
                                const updatedChat = { ...targetChat, updated_at: new Date().toISOString() };
                                return mainChat 
                                    ? [mainChat, updatedChat, ...otherChats]
                                    : [updatedChat, ...otherChats];
                            }
                            return prevChats;
                        });
                    }
                } catch (error) {
                    setErrorMessage("Error handling new message");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                }
            };
            const handleConfirmedMessage = (confirmedMessage) => {
                try {
                    setChannel((prevMessages) => [...prevMessages, confirmedMessage]);
                    setTimeout(() => {
                        const container = messagesContainerRef.current;
                        if (container) {
                            container.scrollTop = container.scrollHeight;
                        }
                    }, 0);
                } catch (error) {
                    setErrorMessage("Error handling confirmed message");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                }
            };
            const handleMessageEdited = (editedMessage) => {
                try {
                    setChannel((prevMessages) =>
                        prevMessages.map(msg =>
                            msg.message_id === editedMessage?.message_id
                                ? {
                                    ...msg,
                                    content: editedMessage?.content, //Already decrypted
                                    edited_at: editedMessage?.edited_at
                                }
                                : msg
                        )
                    );
                } catch (error) {
                    setErrorMessage("Error handling edited message");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                }
            };
            const handleMessagesRead = ({ chat_id, reader_id }) => {
                try {
                    if (chat_id === channelId) {
                        setChannel((prevMessages) =>
                            prevMessages.map(msg =>
                                (msg?.sender_id !== reader_id && !msg?.is_read)
                                    ? { ...msg, is_read: true }
                                    : msg
                            )
                        );
                    }
                } catch (error) {
                    setErrorMessage("Error handling messages read");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                }
            };
            const handleMessageFailed = ({ message_id, error }) => {
                setErrorMessage(error || "Failed to send message");
                setTimeout(() => { setErrorMessage(''); }, 5000);
            };
            try {
                socket.on('new_message', handleNewMessage);
                socket.on(confirmedRoute, handleConfirmedMessage);
                socket.on(deleteRoute, deleteMessage);
                socket.on('messages_marked_read', handleMessagesRead);
                socket.on('message_edited', handleMessageEdited);
                socket.on('message_send_failed', handleMessageFailed);
            } catch (error) {
                setErrorMessage("Error setting up socket listeners");
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
            return () => {
                try {
                    if (socket.connected) {
                        socket.emit(leaveRoute, channelId);
                    }
                    socket.off('new_message', handleNewMessage);
                    socket.off(confirmedRoute, handleConfirmedMessage);
                    socket.off(deleteRoute, deleteMessage);
                    socket.off('messages_marked_read', handleMessagesRead);
                    socket.off('message_edited', handleMessageEdited);
                    socket.off('message_send_failed', handleMessageFailed);
                } catch (error) {
                    setErrorMessage("Connection error");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                }
            };
        } catch (error) {
            setErrorMessage("Unexpected error");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [channelId, isGroup, getChannelMessages, deleteMessage, setChats, setErrorMessage]);

    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.emit('join_channel_type', isGroup ? 'feed_chat' : 'direct_message');
        }
    }, [isGroup]);

    //Reset channel when channelId changes
    useEffect(() => {
        if (channelId) {
            setChannel([]);
            setOffset(0);
            setHasMore(true);
            isInitialLoad.current = true;
            getChannelMessages(channelId, 0);
        }
    }, [channelId, getChannelMessages]);

    //Mark channel as seen when entering
    useEffect(() => {
        if (channelId && isGroup) {
            //Update localStorage immediately for instant UI feedback
            updateChannelView(channelId);
            //Notify other components that channel was viewed
            window.dispatchEvent(new Event('channelViewed'));
            //Sync with backend asynchronously (only if authenticated)
            if (viewer?.feed_id && isAuthenticated) {
                api.post('/mark_channel_seen', {
                    channelId,
                    viewerId: viewer.feed_id
                }).catch(error => {
                    console.error('Error syncing channel view with backend:', error);
                });
            }
        }
    }, [channelId, viewer?.feed_id, isAuthenticated, isGroup]);

    //Infinite scrolling
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (container.scrollTop <= 10 && hasMore && !isLoadingMore) {
                setIsLoadingMore(true);
                getChannelMessages(channelId, offset).finally(() => {
                    setIsLoadingMore(false);
                });
            }
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [channelId, getChannelMessages, hasMore, offset, isLoadingMore]);

    const handleFileSelect = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;
        //Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
        if (!validTypes.includes(file.type)) {
            setErrorMessage('Invalid file type. Only images and videos are allowed.');
            setTimeout(() => setErrorMessage(''), 5000);
            return;
        }
        //Validate file size
        const isVideo = file.type.startsWith('video/');
        const maxSize = isVideo
            ? (user?.has_membership ? 10000 : 100) * 1024 * 1024
            : (user?.has_membership ? 500 : 5) * 1024 * 1024;

        if (file.size > maxSize) {
            const maxSizeMB = maxSize / (1024 * 1024);
            setErrorMessage(`File size exceeds ${maxSizeMB}MB limit`);
            setTimeout(() => setErrorMessage(''), 5000);
            return;
        }
        //Store file and create blob URL for preview (like contentForm)
        const blobUrl = URL.createObjectURL(file);
        setAttachedMedia(file);
        setMediaPreview({
            url: blobUrl,
            type: isVideo ? 'video' : 'image'
        });
    }, [user?.has_membership, setErrorMessage]);

    const removeMedia = useCallback(() => {
        //Revoke blob URL to free memory
        if (mediaPreview?.url) {
            URL.revokeObjectURL(mediaPreview.url);
        }
        setAttachedMedia(null);
        setMediaPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [mediaPreview]);

    //Send message with connection checks
    const sendMessage = useCallback(async () => {
        try {
            //Check if message has content or media
            if (!message.trim() && !attachedMedia) {
                setErrorMessage("Message cannot be empty");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            //Only validate text if there is text content
            if (message.trim()) {
                const validation = ValidateTextInput(message, 1, maxLength, false);
                if (!validation.valid) {
                    setErrorMessage(validation.error);
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
            }
            if (!socketRef.current || !socketRef.current.connected) {
                setErrorMessage("Error, please try again.");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                if (socketRef.current) socketRef.current.connect();
                return;
            }
            //Upload media first if attached (only at send time, like contentForm)
            let mediaData = null;
            if (attachedMedia) {
                setIsUploadingMedia(true);
                try {
                    const formData = new FormData();
                    formData.append('files', attachedMedia);
                    formData.append('messageType', isGroup ? 'channel' : 'direct');
                    const response = await api.post('/upload_message_media', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (response.data.success && response.data.media && response.data.media.length > 0) {
                        mediaData = response.data.media;
                    } else {
                        throw new Error('Upload failed');
                    }
                } catch (error) {
                    setErrorMessage('Failed to upload media');
                    setTimeout(() => setErrorMessage(''), 5000);
                    setIsUploadingMedia(false);
                    return;
                } finally {
                    setIsUploadingMedia(false);
                }
            }
            const newMessage = {
                message_id: v4(),
                content: message, //Send plaintext (encryption happens server-side for private messages)
                sender_id: viewer?.feed_id,
                receiver_id: isGroup ? null : connection?.feed_id,
                channel_id: channelId,
                created_at: Date.now(),
                media: mediaData,
            };
            const route = isGroup ? 'send_feed_message' : 'send_direct_message';
            socketRef.current.emit(route, newMessage);
            setMessage('');
            removeMedia();
            //Move current chat to top of list (after Main)
            if (!isGroup && setChats) {
                setChats(prevChats => {
                    const mainChat = prevChats.find(c => c?.title === 'Main');
                    const currentChat = prevChats.find(c => c?.chat_id === channelId);
                    const otherChats = prevChats.filter(c => c?.title !== 'Main' && c?.chat_id !== channelId);
                    if (currentChat) {
                        const updatedChat = { ...currentChat, updated_at: new Date().toISOString() };
                        return mainChat
                            ? [mainChat, updatedChat, ...otherChats]
                            : [updatedChat, ...otherChats];
                    }
                    return prevChats;
                });
            }
        } catch (error) {
            setErrorMessage("Error sending message");
            setTimeout(() => { setErrorMessage(''); }, 5000);
            setIsUploadingMedia(false);
        }
    }, [channelId, isGroup, message, setChats, setErrorMessage, viewer?.feed_id, connection?.feed_id, attachedMedia, removeMedia, maxLength]);

    return (
        <div className="channel">
            <div className="channel-content" ref={messagesContainerRef}>
                {channel.length > 0 ? (
                    channel.map((msg, index) => (
                        <Message
                            key={msg?.message_id || index}
                            canRemove={canRemove}
                            deleteMessage={deleteMessage}
                            editMessage={editMessage}
                            editingMessageId={editingMessageId}
                            setEditingMessageId={setEditingMessageId}
                            editContent={editContent}
                            setEditContent={setEditContent}
                            isGroup={isGroup}
                            isOutgoing={msg?.sender_id === viewer?.feed_id}
                            isRead={msg?.is_read}
                            message={msg}
                            maxLength={maxLength}
                        />
                    ))
                ) : (   
                    <p className="large-text">No messages yet</p>
                )}
                <div ref={messagesEndRef} />
            </div>
            {(!isLocked || canAdd) && (
                <div className="messages-channel-footer">
                    {mediaPreview && (
                        <div className="media-preview-container">
                            <button className="remove-media-button" onClick={removeMedia} title="Remove media">
                                <FaTimes />
                            </button>
                            {mediaPreview.type === 'video' ? (
                                <video src={mediaPreview.url} controls className="media-preview" />
                            ) : (
                                <img src={mediaPreview.url} alt="Preview" className="media-preview" />
                            )}
                        </div>
                    )}
                    <div className="message-input-row">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska"
                            style={{ display: 'none' }}
                        />
                        <button
                            className="attach-media-button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!isAuthenticated || isUploadingMedia || !!attachedMedia}
                            title="Attach media"
                        >
                            <FaPaperclip />
                        </button>
                        <input
                            className="chat-message-bar"
                            type="text"
                            value={message}
                            placeholder={isAuthenticated ? "Type a message..." : "Login to chat"}
                            disabled={!isAuthenticated || isUploadingMedia}
                            onChange={(e) => {
                                const input = e.target.value;
                                const validation = ValidateTextInput(input, 0, maxLength, false);
                                if (!validation.valid) {
                                    setValidationError(validation.error);
                                    if (input.length > maxLength) {
                                        return;
                                    }
                                } else {
                                    setValidationError('');
                                }
                                setMessage(input);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && isAuthenticated && !isUploadingMedia && sendMessage()}
                        />
                        <button
                            className={`chat-send-button${!isAuthenticated || isUploadingMedia ? ' disabled' : ''}`}
                            onClick={sendMessage}
                            disabled={!isAuthenticated || isUploadingMedia}
                        >
                            {isUploadingMedia ? 'Uploading...' : 'Send'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatChannel;