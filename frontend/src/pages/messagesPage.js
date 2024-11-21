import axios from 'axios';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../components/authContext';
import { io } from "socket.io-client";
import { Link, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import ManageConnectionButton from '../components/manageConnectionButton';
import Message from '../components/message';

const MessagesPage = () => {
    const [changedChatName, setChangedChatName] = useState('');
    const [chat, setChat] = useState([]);
    const [chats, setChats] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [connections, setConnections] = useState([]);
    const { connection_name, title } = useParams();
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [message, setMessage] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [selectedChats, setSelectedChats] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const socketRef = useRef(null);
    const { user, viewer } = useContext(AuthContext)
    const navigate = useNavigate();

    useEffect(() => {
        const getConnections = async () => {
            try {
                const response = await axios.get(`/api/get_connections/${viewer.feed_id}`);
                setConnections(response.data);
            } catch (error) {
                setErrorMessage("Error getting connections");
            }
        };
        const getChats = async () => {
            try {
                const response = await axios.get(`/api/get_chats/${viewer.feed_id}`);
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
    }, []);
    
    //Filters chats to those with a specific connection
    useEffect(() => {
        if (chats.length > 0 && connection_name) {
            const filteredChats = chats.filter(chat => {
                const feedNames = chat.feeds?.map(feed => feed.feed_name);
                return feedNames.includes(connection_name);
            });
            setSelectedChats(filteredChats);
            if (title) {
                const selected = filteredChats.find(c => c.title === title);
                if (selected) {
                    setSelectedChatId(selected.chat_id);
                }
            } else {
                const mainChat = filteredChats.find(c => c.title === 'Main');
                setSelectedChatId(mainChat ? mainChat.chat_id : null);
            }
        } else {
            setSelectedChats([]);
            setSelectedChatId(null);
        }
    }, [connection_name, chats, title]);

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
                        msg.senderId === message.senderId &&
                        msg.message_content === message.message_content
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

    //Either user can change chat name
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
                            chat.chatId === selectedChatId
                            ? {...chat, title: changedChatName}
                            : chat
                        )
                    );
                    setSelectedChats(prevSelected =>
                        prevSelected.map(chat =>
                            chat.chatId === selectedChatId
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
        } catch {
            setErrorMessage("Error changing chat name");
        }
    };

    //Currently viewed chat
    const currentChat = selectedChats.find(c => c.chat_id === selectedChatId);
    const currentChatName = currentChat?.title;

    const createNewChat = async (event) => {
        event.preventDefault();
        try {
            const connection = connections.find(c => c.feed_name === connection_name);
            const participants = [{ feed_id: viewer.feed_id }, {feed_id: connection.feed_id}];
            const chatName = newChatName.length === 0 ? 'New chat' : newChatName;
            if (newChatName.length >= 30) {
                setErrorMessage("Name too long"); 
                return; 
            } else if (newChatName === 'Main') {
                setErrorMessage("Cannot be named Main");
                return;
            } else {
                const response = await axios.post('/api/create_chat', {
                    participants: participants,
                    title: chatName
                });
                console.log("response:", response);
                if (response.data && response.status === 201) {
                    const newChat = {
                        ...response.data.newChat,
                        title: chatName,
                        feeds: connection ? [connection] : [],
                    };
                    setChats(prevChats => [...prevChats, newChat]);
                    setSelectedChats(prevSelected => [...prevSelected, newChat]);
                    setSelectedChatId(newChat.chatId);
                    navigate(`/messages/${connection_name}/${newChatName}`)
                    setErrorMessage('');
                    setNewChatName('');
                    setShowForm(false);
                } else {
                    setErrorMessage("Failed to add chat.");
                }
            }
        } catch (error) {
            console.log("creating chat error:", error);
            setErrorMessage("Failed to create chat.");
        }
    };

    const deleteChat = async () => {
        try {
            if (title === 'Main') {
                setErrorMessage("Main chat cannot be deleted.");
                return;
            }
            await axios.delete(`/api/delete_chat`, { data: {chat_id: selectedChatId, title: title} });
            //Show chat list without deleted chat
            setChats(prevChats => 
                prevChats.filter(c => c.chatId !== selectedChatId)
            );
            setSelectedChats(prevSelected => 
                prevSelected.filter(c => c.chatId !== selectedChatId)
            );
            setSelectedChatId(null);
            setChat([]);
            navigate(`/messages/${connection_name}/Main`);
        } catch (error) {
            setErrorMessage('Error deleting chat');
        }
    };

    const deleteMessage = (messageId) => {
        if (messageId) {
            socketRef.current.emit('delete_message', {
                message_id: messageId,
                channel_id: selectedChatId,
            });
            setChat(prevChat => prevChat.filter(msg => msg.message_id !== messageId));
        } else {
            setErrorMessage('Error deleting message');
        }
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
                message_content: message,
                senderId: user.userId,
                chatId: selectedChatId,
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
                        <>
                            {connection_name && selectedChatId && (
                                chat.slice().reverse().map((msg, index) => (
                                    <Message key={index} canRemove={false} deleteMessage={deleteMessage} message={msg} isOutgoing={msg.senderId === user.userId} />
                                ))
                            )}
                            <div className="messages-channel-footer">
                                <input className="chat-message-bar" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && sendMessage()}/>
                                <button className="chat-send-button" onClick={sendMessage}>Send</button>
                            </div>
                        </>
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
                                            e.preventDefault();
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
                                            <button className="button" onClick={() => {
                                                setIsEditingChatName(false);
                                                setChangedChatName('');
                                                setErrorMessage('');
                                            }}>Cancel</button>
                                            <button className="button" onClick={(e) => {
                                                e.preventDefault();
                                                changeChatName(e)
                                            }}>Save</button>
                                        </div>
                                        <button className="button" onClick={() => deleteChat()}>Delete chat</button> 
                                    </div>
                                ) : (
                                    <div id="chat-name">
                                        <p className="text36">{currentChatName}</p> 
                                        <button className="button" onClick={() => {
                                            setIsEditingChatName(true);
                                            setChangedChatName(currentChatName);
                                        }}>Rename</button>
                                        <button className="button" onClick={() => deleteChat()}>Delete chat</button> 
                                    </div>
                                    
                                )}
                            </div>
                        ) : (
                            <p className="text36">Main</p>  
                        )}
                        <ul>
                            {selectedChats.map(chat => (
                                <li key={chat.chat_id} className="channel-item">
                                    <Link to={`/messages/${connection_name}/${chat.title}`}>
                                        <div className="channel-link">{chat.title}</div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div className="add-channel-section">
                            <button className="button" onClick={toggleForm}>
                                {showForm ? 'Close': 'Add chat'}
                            </button>
                            {showForm && (
                                <form className="add-channel-form" onSubmit={createNewChat}>
                                    <input className="name-input" type="text" name="chat_name" placeholder="Chat name..." value={newChatName} onChange={(e) => setNewChatName(e.target.value)}/>
                                    <input className="dark-button" type="submit" value="Add" />
                                </form>  
                            )}                          
                        </div>
                    </div>
                ) : (
                    <nav className="feed-list">
                        <h2>Messages</h2>
                        <ul>
                            {connections.map(c => (
                                <li className="feed-list-item" key={c.connection_id}>
                                    <Link className="feed-list-link-container" to={`/messages/${c.feed_name}`}>
                                    <img className="small-feed-photo" src={`/${c.feed_photo}`} alt="Feed"/>
                                        <div className="feed-list-text">
                                            {c.feed_name}
                                        </div>
                                    </Link>
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