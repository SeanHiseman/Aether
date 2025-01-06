import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../../components/authContext';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import { FaEdit, FaMinus, FaPlus, FaTrash } from 'react-icons/fa';
import ChannelList from '../../components/channels/channelList';
import Message from './message';

const ChatPage = () => {
    const { connection_name, title } = useParams();
    const { viewer } = useContext(AuthContext);
    const [connection, setConnection] = useState(null);
    const [chats, setChats] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [chat, setChat] = useState([]);
    const [message, setMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [changedChatName, setChangedChatName] = useState('');
    const socketRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const fetchChats = useCallback(async () => {
        try {
            const response = await axios.get(`/api/get_chats/${viewer.feed_id}`, {
                params: { connectionName: connection_name }
            });
            if (response.data.success) {
                setChats(response.data.chats);
                setConnection(response.data.connection);
            } else {
                setErrorMessage('Failed to fetch chats');
            }
        } catch (error) {
            console.error(error);
            setErrorMessage('Error getting chats');
        }
    }, [connection_name, viewer.feed_id]);
    
    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

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

    const currentChat = chats.find(c => c.chat_id === selectedChatId);
    const currentChatName = currentChat?.title;

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
            const response = await axios.post('/api/create_chat', {
                participants,
                title: chatName
            });
            if (response.data && response.status === 201) {
                setNewChatName('');
                setShowForm(false);
                navigate(`/connections/${connection_name}/${chatName}`);
                fetchChats();  
            } else {
                setErrorMessage("Failed to create chat");
            }
        } catch (error) {
            setErrorMessage("Failed to create chat");
        }
    };

    const changeChatName = async (event) => {
        event.preventDefault();
        if (!selectedChatId) return;
        try {
            if (changedChatName.length === 0) {
                setErrorMessage("Chat needs a name");
                return;
            }
            if (changedChatName === 'Main') {
                setErrorMessage("Cannot be named Main");
                return;
            }
            const response = await axios.post('/api/change_chat_name', {
                chatId: selectedChatId,
                newTitle: changedChatName
            });
            if (response.status === 200) {
                setChangedChatName('');
                setIsEditingChatName(false);
                navigate(`/connections/${connection_name}/${changedChatName}`);
                fetchChats();
            }
        } catch (error) {
            setErrorMessage("Error changing chat name");
        }
    };

    const deleteChat = async () => {
        if (!selectedChatId) return;
        if (!window.confirm(`Are you sure you want to delete ${title}?`)) return;
        try {
            if (title === 'Main') {
                setErrorMessage("Main chat cannot be deleted.");
                return;
            }
            await axios.delete(`/api/delete_chat`, {
                data: { chatId: selectedChatId, title }
            });
            setSelectedChatId(null);
            setChat([]);
            navigate(`/connections/${connection_name}/Main`);
            fetchChats();  
        } catch (error) {
            setErrorMessage("Error deleting chat");
        }
    };

    const deleteMessage = (messageId) => {
        console.log("deleting chat");
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
            setChat(response.data);
        } catch (error) {
            setErrorMessage('Error getting messages');
        }
    };

    const isMainChat = () => {
        return currentChatName === 'Main' || title === 'Main';
    };

    const sendMessage = () => {
        try {
            if (!message.trim()) return;
            const newMessage = {
                message_id: v4(),
                content: message,
                sender_id: viewer.feed_id,
                chat_id: selectedChatId,
                timestamp: Date.now()
            };
            socketRef.current.emit('send_direct_message', newMessage);
            setChat(prev => [...prev, newMessage]);
            setChats(prevChats => { //Moves current chat to top of chat list
                const updatedChats = prevChats.map(chat => {
                    if (chat.chat_id === selectedChatId) {
                        return { ...chat, updated_at: new Date().toISOString() };
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
                    {!isMainChat() ? (
                        <div id="chat-change">
                            {isEditingChatName ? (
                                <div id="change-name">
                                    <textarea className="change-name-area" value={changedChatName} placeholder="New name" onChange={(e) => {
                                        const input = e.target.value;
                                        const inputLength = input.length;
                                        if (inputLength <= 30) {
                                            setChangedChatName(input)
                                        } else {
                                            setErrorMessage('Name too long');
                                        }
                                    }}
                                    />
                                    <div id="cancel-save">
                                        <button className="button" onClick={() => {setIsEditingChatName(false); setChangedChatName(''); setErrorMessage('');}}>
                                            Cancel
                                        </button>
                                        <button className="button" onClick={(e) => {changeChatName(e)}}>
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div id="chat-name">
                                    <p className="text36">{currentChatName}</p> 
                                    <div className="button-group">
                                        <button className="small-icon" onClick={() => {setIsEditingChatName(true); setChangedChatName(currentChatName);}}>
                                            <FaEdit />
                                        </button>
                                        <button className="small-icon" onClick={() => deleteChat()}>
                                            <FaTrash />
                                        </button> 
                                    </div>
                                </div>
                                
                            )}
                        </div>
                    ) : (
                        <p className="text36">Main</p>  
                    )}
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
