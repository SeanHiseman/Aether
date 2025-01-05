import axios from 'axios';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../components/authContext';
import { FaEdit, FaMinus, FaPlus, FaTrash } from 'react-icons/fa';
import { io } from "socket.io-client";
import { Link, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import ChannelList from '../components/channels/channelList';
import ManageConnectionButton from '../components/manageConnectionButton';
import Message from '../components/message';

const MessagesPage = () => {
    const [changedChatName, setChangedChatName] = useState('');
    const [chat, setChat] = useState([]);
    const [chats, setChats] = useState([]);
    const [connections, setConnections] = useState([]);
    const [connectionChats, setConnectionChats] = useState([]);
    const { connection_name, title } = useParams();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [message, setMessage] = useState('');
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [newChatName, setNewChatName] = useState('');
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const socketRef = useRef(null);
    const { viewer } = useContext(AuthContext)
    const navigate = useNavigate();

    useEffect(() => {
        const getConnections = async () => {
            try {
                if (viewer.feed_id) {
                    const response = await axios.get(`/api/get_connections/${viewer.feed_id}`);
                    setConnections(response.data);
                };
            } catch (error) {
                setErrorMessage("Error getting connections");
            }
        };
        const getChats = async () => {
            try {
                const queryParams = connection_name ? `?connectionName=${connection_name}` : '';
                const response = await axios.get(`/api/get_chats/${viewer.feed_id}${queryParams}`);
                setChats(response.data);
            } catch (error) {
                setErrorMessage("Error getting chats");
            }
        };
        getConnections();
        getChats();
        socketRef.current = io(`http://localhost:7000`);
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [viewer.feed_id, connection_name]);

    useEffect(() => {
        if (title && chats.length > 0) {
            const matchingChat = chats.find(
                chat => chat.title === title
            );
            setSelectedChatId(matchingChat ? matchingChat.chat_id : null);
        }
    }, [connection_name, title, chats]);

    useEffect(() => {
        if (selectedChatId) {
            getChatMessages(selectedChatId); 
            socketRef.current.emit('join_chat', selectedChatId);
            const handleReceiveMessage = (message) => {
                setChat(prevChat => [...prevChat, message]);
            };
            const handleMessageConfirmed = (message) => {
                setChat(prevChat =>
                    prevChat.map(msg => 
                        msg.message_id === undefined &&
                        msg.sender_id === message.sender_id &&
                        msg.content === message.content
                            ? { ...msg, message_id: message.message_id }
                            : msg
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
        } else {
            setChat([]);
        }
    }, [selectedChatId]);

    //Ensures header title is reset when returning to main messages page
    useEffect(() => {
        if (!connection_name) {
            setSelectedChatId(null);
        } 
    }, [connection_name]);

    //Auto-scroll to bottom when chat updates
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chat]);

    //Either participant can change chat name
    const changeChatName = async (event) => {
        event.preventDefault();
        try {
            if (changedChatName.length === 0) {
                setErrorMessage("Chat needs a name");
                return;
            //Names over 30 characters already prevented
            } else if (changedChatName === 'Main') {
                setErrorMessage("Cannot be named Main");
                return;
            } else {
                const response = await axios.post('/api/change_chat_name', {
                    chatId: selectedChatId,
                    newTitle: changedChatName
                });
                if (response.status === 200) {
                    setChats(prevChats => 
                        prevChats.map(chat =>
                            chat.chat_id === selectedChatId
                            ? {...chat, title: changedChatName}
                            : chat
                        )
                    );
                    setErrorMessage('');
                    setIsEditingChatName(false);
                    setChangedChatName('');
                    navigate(`/messages/${connection_name}/${changedChatName}`);
                }
            }
        } catch (error) {
            setErrorMessage("Error changing chat name");
        }
    };

    //Currently viewed chat
    const currentChat = chats.find(chat => chat.chat_id === selectedChatId);
    const currentChatName = currentChat?.title;

    const createNewChat = async (event) => {
        event.preventDefault();
        try {
            const connection = connections.find(c => c.feed_name === connection_name);
            const participants = [{ feed_id: viewer.feed_id }, {feed_id: connection.feed_id}];
            const chatName = newChatName.length === 0 ? 'New chat' : newChatName; //New chat doesn't have to have a name set
            if (chatName.length >= 30) {
                setErrorMessage("Name too long"); 
                return; 
            } 
            if (chatName === 'Main') {
                setErrorMessage("Cannot be named Main");
                return;
            } 
            const chatExists = chats.some(chat => chat.title === chatName);
            if (chatExists) {
                setErrorMessage("Name already used");
                return;
            }
            const response = await axios.post('/api/create_chat', {
                participants: participants,
                title: chatName
            });
            if (response.data && response.status === 201) {
                const newChat = { //Gets in correct format
                    ...response.data.newChat,
                    title: chatName,
                    feeds: connection ? [connection] : [],
                };
                setChats(prevChats => [...prevChats, newChat]);
                setSelectedChatId(newChat.chat_id);
                navigate(`/messages/${connection_name}/${chatName}`)
                setErrorMessage('');
                setNewChatName('');
                setShowForm(false);
            } else {
                setErrorMessage("Failed to add chat.");
            }
        } catch (error) {
            setErrorMessage("Failed to create chat.");
        }
    };

    const deleteChat = async () => {
        if (window.confirm(`Are you sure you want to delete ${title}?`)) {
            try {
                if (title === 'Main') {
                    setErrorMessage("Main chat cannot be deleted.");
                    return;
                }
                await axios.delete(`/api/delete_chat`, { data: {chatId: selectedChatId, title: title} });
                //Show chat list without deleted chat
                setChats(prevChats => 
                    prevChats.filter(c => c.chat_id !== selectedChatId)
                );
                setSelectedChatId(null);
                setChat([]);
                navigate(`/messages/${connection_name}/Main`);
            } catch (error) {
                setErrorMessage('Error deleting chat');
            }
        }
    };

    const deleteMessage = (messageId) => {
        if (messageId) {
            socketRef.current.emit('delete_direct_message', {
                message_id: messageId,
                channel_id: selectedChatId,
            });
            setChat(prevChat => prevChat.filter(msg => msg.message_id !== messageId));
        } else {
            setErrorMessage('Error deleting message');
        }
    };

    //Dropdown for chats
    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    //Get messages from a specific chat
    const getChatMessages = async (chatId) => {
        try {
            const response = await axios.get(`/api/get_chat_messages/${chatId}`);
            setChat(response.data);
        } catch (error) {
            setErrorMessage("Error getting messages");
        }
    };

    //Ensures main chat can't be modified upon initial render
    const isMainChat = () => {
        return currentChatName === 'Main' || title === 'Main';
    };

    const sendMessage = () => {
        try {
            //Prevents sending empty messages
            if (!message.trim()) return;
            //Emits new message to server
            const newMessage = {
                message_id: v4(),
                content: message,
                sender_id: viewer.feed_id,
                chat_id: selectedChatId,
                timestamp: Date.now()
            };
            socketRef.current.emit('send_direct_message', newMessage);
            setChat(prevChat => [...prevChat, newMessage]);
            setMessage('');
        } catch (error) {
            setErrorMessage("Error sending message");
        }
    };

    const toggleForm = () => { setShowForm(!showForm) }

    const updateConnectionChats = useCallback((newChats) => {
        setConnectionChats(newChats);
    }, []);

    //Gets feed photo of viewed connection
    const connectionProfileImage = connections.find(c => c.feed_name === connection_name)?.feed_photo || '';

    document.title = "Messages";
    return (
        <div className="messages-container">
            <div className="messages-feed">
                <div className={`channel-content ${!connection_name ? '' : 'messages'}`}>
                    {!connection_name ? (
                        <ul className="content-list">
                            {connections.map(c => (
                                <li key={c.connection_id}>
                                    <div className="result-widget">
                                        <Link className="feed-link" to={`/u/${c.feed_name}`}>
                                            <img className="large-feed-photo" src={`/${c.feed_photo}`} alt="Feed" />
                                            <p className="text36 feed-name">{c.feed_name}</p>
                                        </Link>
                                        <div className="remove-connection-box">
                                            <ManageConnectionButton connectRequest={false} feed={c} isConnected={true} viewerId={viewer.feed_id} />
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="messages-section">
                            <div className="messages-list-container" ref={messagesContainerRef}>
                                {connection_name && selectedChatId && (
                                    <>
                                        {chat.map((msg, index) => (
                                            <Message
                                                key={msg.message_id || index}
                                                canRemove={false}
                                                deleteMessage={deleteMessage}
                                                message={msg}
                                                isOutgoing={msg.sender_id === viewer.feed_id}
                                            />
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>
                            <div className="messages-channel-footer">
                                <input
                                    className="chat-message-bar"
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                />
                                <button className="chat-send-button" onClick={sendMessage}>Send</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <aside id="right-aside">
                {connection_name ? (
                    <div id="feed-summary">
                        <Link className="chat-feed-link" to={`/u/${connection_name}`}>
                            <img className="small-feed-photo" src={`/${connectionProfileImage}`} alt="Feed"/>
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
                        <ul>
                            {chats.map(chat => (
                                <li key={chat.chat_id} className="channel-item">
                                    <Link to={`/messages/${connection_name}/${chat.title}`}>
                                        <div className="channel-link">{chat.title}</div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <nav className="feed-list">
                        <h2>Messages</h2>
                        <ul>
                            {connections.map(c => (
                                <li className="feed-list-item" key={c.connection_id}>
                                    <div className="feed-list-link-container">
                                        <Link className="feed-list-link" to={`/messages/${c.feed_name}/Main`}>
                                            <img className="small-feed-photo" src={`/${c.feed_photo}`} alt="Feed"/>
                                            <p className="feed-list-text">{c.feed_name}</p>
                                        </Link>
                                        <p className="channel-dropdown" onClick={dropdownToggle}>
                                            =
                                        </p>
                                    </div>
                                    {dropdownOpen && (
                                        <ChannelList channels={connectionChats} feedId={c.feed_id} feedName={c.feed_name} isChat={true} isGroup={false} setChannels={updateConnectionChats} />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </aside>
        </div>
    );
}

export default MessagesPage;