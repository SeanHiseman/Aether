import axios from 'axios';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ChannelName from '../../components/channels/channelName';
import { decrypt, encrypt } from '../../encryptionUtil';
import Message from './message';

const ChatPage = () => {
    const { connection_name, title } = useParams();
    const [connection, setConnection] = useState(null);
    const [chat, setChat] = useState([]);
    const [chats, setChats] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [message, setMessage] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const { viewer } = useContext(AuthContext);
    const socketRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const fetchConnection = async () => {
        try {
            const response = await axios.get(`/api/get_connection/${connection_name}`);
            setConnection(response.data.connection); 
        } catch (error) {
            setErrorMessage('Error getting connection');
        }
    };
    
    useEffect(() => {
        fetchConnection();
    }, []);

    useEffect(() => {
        if (title && chats.length > 0) {
            const found = chats.find(c => c.title === title);
            setSelectedChatId(found ? found.chat_id : null);
        } 
    }, [title, chats]);

    useEffect(() => {
        socketRef.current = io(`http://localhost:7000`);
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        if (!selectedChatId) {
            setChat([]);
            return;
        }
        getChatMessages(selectedChatId);
        socketRef.current.emit('join_chat', selectedChatId);
        const handleReceiveMessage = (msg) => {
            setChat(prev => [...prev, msg]);
        };
        const handleMessageConfirmed = (msg) => {
            setChat(prev =>
                prev.map(oldMsg =>
                    !oldMsg.message_id &&
                    oldMsg.sender_id === msg.sender_id &&
                    oldMsg.content === msg.content
                        ? { ...oldMsg, message_id: msg.message_id }
                        : oldMsg
                )
            );
        };
        socketRef.current.on('receive_message', handleReceiveMessage);
        socketRef.current.on('message_confirmed', handleMessageConfirmed);
        return () => {
            socketRef.current.emit('leave_chat', selectedChatId);
            socketRef.current.off('receive_message', handleReceiveMessage);
            socketRef.current.off('message_confirmed', handleMessageConfirmed);
        };
    }, [selectedChatId]);

    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chat]);

    //Updates list of chats when chat name changed
    const chatUpdate = (chatId, newName) => {
        setChats(prevChats => 
            prevChats.map(chat =>
                chat.chat_id === chatId ? {...chat, title: newName} : chat
            )
        );
    };

    const createNewChat = async (event) => {
        event.preventDefault();
        try {
            if (!connection) {
                setErrorMessage("No matching connection found");
                return;
            }
            const participants = [
                { feed_id: viewer.feed_id },
                { feed_id: connection.feed_id }
            ];
            const chatName = newChatName.length === 0 ? 'New chat' : newChatName;
            if (chatName.length >= 30) {
                setErrorMessage("Name too long");
                return;
            }
            if (chatName === 'Main') {
                setErrorMessage("Cannot be named Main");
                return;
            }
            const chatExists = chats.some(c => c.title === chatName);
            if (chatExists) {
                setErrorMessage("Name already used");
                return;
            }
            const encryptedChatName = encrypt(chatName);
            const response = await axios.post('/api/create_chat', {
                participants,
                title: encryptedChatName
            });
            if (response.data && response.status === 201) {
                const newChat = response.data.newChat;
                const decryptedTitle = decrypt(newChat.title);
                const updatedChats = [...chats, { ...newChat, title: decryptedTitle }];
                setChats(updatedChats);
                setErrorMessage('');
                setNewChatName('');
                setShowForm(false);
                navigate(`/connections/${connection_name}/${chatName}`);
            } else {
                setErrorMessage("Failed to create chat");
            }
        } catch (error) {
            setErrorMessage("Failed to create chat");
        }
    };

    const deleteChat = (chatId) => {
        setChats(prevChats => prevChats.filter(chat => chat.chat_id !== chatId));
    };

    const deleteMessage = (messageId) => {
        try {
            if (!messageId) return;
            socketRef.current.emit('delete_direct_message', {
                message_id: messageId,
                channel_id: selectedChatId,
            });
            setChat(prev => prev.filter(m => m.message_id !== messageId));  
        } catch (error) {
            console.log("deleting error:", error);
            setErrorMessage("Error deleting message");
        }
    };

    const getChatMessages = async (chatId) => {
        try {
            const response = await axios.get(`/api/get_chat_messages/${chatId}`);
            const ciphertextMessages = response.data;
            const decryptedMsgs = ciphertextMessages.map((m) => ({
                ...m,
                content: decrypt(m.content),
            }));
            setChat(decryptedMsgs);
        } catch (error) {
            setErrorMessage('Error getting messages');
        }
    };

    const sendMessage = () => {
        try {
            if (!message.trim()) return;
            const encryptedContent = encrypt(message);
            const newMessage = {
                message_id: v4(),
                content: encryptedContent,
                sender_id: viewer.feed_id,
                chat_id: selectedChatId,
                timestamp: Date.now()
            };
            socketRef.current.emit('send_direct_message', newMessage);
            const displayedMessage = { ...newMessage, content: message }; //Prevents displaying ciphertext
            setChat(prev => [...prev, displayedMessage]);
            setChats(prevChats => { //Moves current chat to top of chat list
                const updatedChats = prevChats.map(chat => {
                    if (chat.chat_id === selectedChatId) {
                        return { ...chat, updated_at: new Date().toISOString() }; //Change to use local time
                    }
                    return chat;
                });
                return updatedChats.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            });
            setMessage('');
        } catch (error) {
            setErrorMessage("Error sending message");
        }
    };
    
    const toggleForm = () => { setShowForm(!showForm) }

    const updateChats = useCallback((newChats) => {
        setChats(newChats);
    }, []);

    document.title = connection_name;
    return (
        <div className="standard-container">
            <div className="messages-section">
                <div className="messages-list-container" ref={messagesContainerRef}>
                    {chat.map((msg, index) => (
                        <Message
                            key={msg.message_id || index}
                            message={msg}
                            isOutgoing={msg.sender_id === viewer.feed_id}
                            canRemove={false}
                            deleteMessage={deleteMessage}
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
                        if (e.target.value.length > 1000) {
                            setErrorMessage("Message cannot exceed 1000 characters.");
                            return;
                        }
                        setErrorMessage('');
                        setMessage(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button className="chat-send-button" onClick={sendMessage}>
                    Send
                </button>
                </div>
            </div>
            <aside id="right-aside">
                {connection && (
                    <div id="feed-summary">
                    <Link className="chat-feed-link" to={`/u/${connection_name}`}>
                        <img className="small-feed-photo" src={`/${connection.feed_photo}`} alt="Feed"/>
                        <p className="feed-list-text">{connection_name}</p>
                    </Link>
                    <div className="error-message">{errorMessage}</div>
                    <ChannelName channelId={selectedChatId} channelName={title} deleteChannel={deleteChat} isChat={true} isGroup={false} locationName={connection_name} channelUpdate={chatUpdate}/>
                    <div className="add-channel-section">
                        <button className="small-icon" onClick={toggleForm}>
                            {showForm ? <FaMinus /> : <FaPlus />}
                        </button>
                        {showForm && (
                            <form className="add-channel-form" onSubmit={createNewChat}>
                                <input className="name-input" type="text" name="chat_name" placeholder="Chat name..." value={newChatName} onChange={(e) => setNewChatName(e.target.value)}/>
                                <button className="small-icon" type="submit" value="Add" ><FaPlus /></button>
                            </form>  
                        )}                          
                    </div>
                    <ChannelList channels={chats} feedId={viewer.feed_id} feedName={connection.feed_name} isChat={true} isGroup={false} setChannels={updateChats} />
                </div>
                )}
            </aside>
        </div>
    );
};

export default ChatPage;
