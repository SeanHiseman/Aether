import axios from 'axios';
import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../../components/authContext';
import { useQueryContext } from '../../components/search/queryContext';
import { FaEdit, FaTrash, FaPlus, FaMinus } from 'react-icons/fa';

const AskChannel = () => {
    const [changedChatName, setChangedChatName] = useState('');
    const [chats, setChats] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [showNewChatForm, setShowNewChatForm] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const location = useLocation();
    const { chatId } = useParams();
    const { query, setQuery } = useQueryContext();
    const { user } = useContext(AuthContext);    
    const navigate = useNavigate();
    const initialMessageRef = useRef(false); //Ref to prevent multiple sends

    useEffect(() => {
        const fetchChats = async () => {
            try {
                const response = await axios.get('/api/get_ask_chats');
                setChats(response.data.chats);
            } catch (error) {
                setErrorMessage('Error fetching chats');
            }
        };
        fetchChats();
    }, []);

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                if (chatId) {
                    //Check for initialMessage in location.state
                    if (location.state?.initialMessage && !initialMessageRef.current) {
                        initialMessageRef.current = true; 
                        await sendAskMessage(chatId, location.state.initialMessage);
                    } else if (query.length !== 0) {
                        setIsLoading(true);
                        await axios.post('/api/send_ask_message', {
                            chatId: chatId,
                            messageContent: query,
                            senderId: user.user_id,
                            timestamp: Date.now()
                        });
                        setIsLoading(false);
                        setQuery('');
                    } else {
                        const response = await axios.get('/api/get_ask_messages', { params: { chatId } });
                        setMessages(response.data.messages.reverse());
                    }
                }
            } catch (error) {
                setErrorMessage('Error getting messages');
            }
        };
        fetchMessages();
    }, [chatId, query, setQuery, user.user_id, location.state]);

    // Find current chat based on ID in URL
    const currentChat = chats.find(chat => chat.chat_id === chatId);
    const chatName = currentChat ? currentChat.name : 'Ask';

    const changeChatName = async (event) => {
        event.preventDefault();
        try {
            if (changedChatName.trim().length === 0) {
                setErrorMessage("Chat needs a name");
                return;
            }
            const response = await axios.post('/api/change_ask_chat_name', {
                chatId: chatId,
                newName: changedChatName.trim()
            });
            if (response.status === 200) {
                setChats(prevChats => prevChats.map(chat => 
                    chat.chat_id === chatId ? { ...chat, name: changedChatName.trim() } : chat
                ));
                setIsEditingChatName(false);
                setChangedChatName('');
                setErrorMessage('');
            }
        } catch (error) {
            setErrorMessage("Error changing chat name");
        }
    };

    const createNewAskChat = async (messageContent = '') => {
        try {
            const newChatId = v4();
            const response = await axios.post('/api/create_ask_chat', {
                chatId: newChatId,
                chatName: newChatName.trim() || "New chat"
            });
            if (response.data && response.status === 201) {
                const newChat = {
                    ...response.data,
                    chatId: response.data.chat_id,
                };
                setChats(prevChats => [newChat, ...prevChats]);
                navigate(`/ask/${newChat.chatId}`, { state: { initialMessage: messageContent } });
                setErrorMessage('');
                setNewChatName('');
                setShowNewChatForm(false);
            } else {
                setErrorMessage("Error creating chat");
            }
        } catch (error) {
            setErrorMessage("Error creating chat");
        }
    };

    const deleteChat = async () => {
        try {
            await axios.delete('/api/delete_ask_chat', { data: { chat_id: chatId } });
            setChats(prevChats => 
                prevChats.filter(chat => chat.chat_id !== chatId)
            );
            navigate('/ask/home');
        } catch (error) {
            setErrorMessage('Error deleting chat');
        }
    };

    // Handle submitting a query through the home chat
    const handleHomeSubmit = async (event) => {
        event.preventDefault();
        try {
            await createNewAskChat(currentMessage);
            setCurrentMessage('');
        } catch (error) {
            setErrorMessage("Error submitting chat");
        }
    };

    const isHome = location.pathname === '/ask/home';

    const sendAskMessage = async (chatId, messageContent = currentMessage) => {
        try {
            setIsLoading(true);
            setCurrentMessage('');
            setChats(prevChats => {
                const currentChat = prevChats.find(chat => chat.chat_id === chatId);
                const otherChats = prevChats.filter(chat => chat.chat_id !== chatId);
                return currentChat ? [currentChat, ...otherChats] : prevChats;
            });
            setMessages(prevMessages => [...prevMessages, { content: messageContent, sender_id: user.user_id }]);
            const response = await axios.post('/api/send_ask_message', {
                chatId: chatId,
                messageContent: messageContent,
                senderId: user.user_id, 
                timestamp: Date.now()
            });
            if (response.data && response.status === 201) {
                const { assistantMessage } = response.data;
                setMessages(prevMessages => [...prevMessages, assistantMessage]);
                setErrorMessage('');
            } else {
                setErrorMessage("Error sending message");
            }
        } catch (error) {
            setErrorMessage("Error sending message");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateChat = async (event) => {
        event.preventDefault();
        if (newChatName.trim().length === 0) {
            setErrorMessage("Chat name cannot be empty");
            return;
        }
        if (newChatName.trim().length > 30) {
            setErrorMessage("Chat name too long");
            return;
        }
        await createNewAskChat();
    };

    const toggleNewChatForm = () => {
        setShowNewChatForm(!showNewChatForm);
        setNewChatName('');
        setErrorMessage('');
    };

    document.title = "Ask";
    return (
        <div className="standard-container">  
            <div className="content-feed">
                {!user.has_membership ? (
                    <div className="message-container incoming">
                        <div className="message incoming">
                            Only members can use Ask. Get membership here:
                        </div>
                        <button className="button join">Join</button>
                    </div>
                ) : (
                    <div className="channel-feed">
                        {isHome ? (
                            <div className="channel">
                                <div className="channel-content">
                                    <p className="text36">Ask anything...</p>
                                </div>
                                <div className="messages-channel-footer">
                                    <input 
                                        className="chat-message-bar" 
                                        type="text" 
                                        value={currentMessage} 
                                        onChange={(e) => setCurrentMessage(e.target.value)} 
                                        placeholder="Ask..." 
                                        onKeyDown={(e) => e.key === 'Enter' && handleHomeSubmit(e)}
                                    />
                                    <button 
                                        className="chat-send-button" 
                                        onClick={handleHomeSubmit}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Loading...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="channel">
                                <div className="channel-content messages">
                                    {messages.map((msg, index) => (
                                        <div 
                                            key={index} 
                                            className={`message-container ${msg.sender_id === user.user_id ? 'outgoing' : 'incoming'}`}
                                        >
                                            <div className={`message ${msg.sender_id === user.user_id ? 'outgoing' : 'incoming'}`}>
                                                {msg.content}
                                            </div>
                                        </div>  
                                    ))}
                                    {isLoading && (
                                        <div className="message-container incoming">
                                            <div className="message incoming">
                                                Typing...
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="messages-channel-footer">
                                    <input 
                                        className="chat-message-bar" 
                                        type="text" 
                                        value={currentMessage} 
                                        onChange={(e) => setCurrentMessage(e.target.value)} 
                                        placeholder="Ask..." 
                                        onKeyDown={(e) => e.key === 'Enter' && sendAskMessage(chatId, currentMessage)} 
                                        disabled={isLoading}
                                    />
                                    <button 
                                        className={isLoading ? "chat-send-button disabled" : "chat-send-button"}
                                        onClick={() => sendAskMessage(chatId, currentMessage)} 
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Loading...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {!user.has_membership ? (
                <aside id="right-aside">
                    <p className="text36">Ask</p>
                </aside>
            ) : (
                <aside id="right-aside">
                    <div className="error-message">{errorMessage}</div>
                    {chatName !== 'Ask' ? (
                        <div id="chat-change">
                            {isEditingChatName ? (
                                <div className="change-name">
                                    <form onSubmit={changeChatName}>
                                        <textarea 
                                            className="change-text-area small" 
                                            value={changedChatName} 
                                            placeholder="New name" 
                                            onChange={(e) => {
                                                const input = e.target.value;
                                                if (input.length <= 30) {
                                                    setChangedChatName(input);
                                                    setErrorMessage('');
                                                } else {
                                                    setErrorMessage('Name too long');
                                                }
                                            }}
                                        />
                                        <div className="button-group">
                                            <button 
                                                className="button" 
                                                type="button" 
                                                onClick={() => {
                                                    setIsEditingChatName(false);
                                                    setChangedChatName('');
                                                    setErrorMessage('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                className="button" 
                                                type="submit"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <div id="chat-name">
                                    <p className="text36">{chatName}</p>
                                    <div className="button-group">
                                        <button 
                                            className="small-icon button" 
                                            onClick={() => {
                                                setIsEditingChatName(true);
                                                setChangedChatName(chatName);
                                            }}
                                        >
                                            <FaEdit />
                                        </button>
                                        <button 
                                            className="small-icon button" 
                                            onClick={deleteChat}
                                        >
                                            <FaTrash />
                                        </button>
                                        <button 
                                            className="small-icon button" 
                                            onClick={toggleNewChatForm}
                                        >
                                            {showNewChatForm ? <FaMinus /> : <FaPlus />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text36">{chatName}</p>
                    )}
                    {showNewChatForm && (
                        <form className="add-channel-form" onSubmit={handleCreateChat}>
                            <input
                                className="name-input"
                                type="text"
                                name="chat_name"
                                placeholder="Chat name..."
                                value={newChatName}
                                onChange={(e) => {
                                    const input = e.target.value;
                                    if (input.length <= 30) {
                                        setNewChatName(input);
                                        setErrorMessage('');
                                    } else {
                                        setErrorMessage("Name too long");
                                    }
                                }}
                                required
                            />
                            <button className="button" type="submit">
                                <FaPlus /> 
                            </button>
                        </form>
                    )}
                    <nav className="channel-list">
                        <ul>
                            {chats.map(chat => (
                                <li key={chat.chat_id} className="channel-item">
                                    <Link to={`/ask/${chat.chat_id}`}>
                                        <div className="channel-link">
                                            {chat.name || "New chat"}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </aside>

            )}
        </div>
    );
};

export default AskChannel;

