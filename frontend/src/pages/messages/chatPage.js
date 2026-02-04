import api from '../../api';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ChatChannel from '../../components/channels/chatChannel';
import { FaEdit, FaMinus, FaPlus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import SwipeableAside from '../../components/swipeableAside';
import { useCallback, useContext, useEffect, useState } from 'react';

const ChatPage = () => {
    const { connection_name, chat_id } = useParams();
    const [connection, setConnection] = useState(null);
    const [chats, setChats] = useState([]);
    const [currentChatTitle, setCurrentChatTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const { user, viewer } = useContext(AuthContext);
    const chatLimit = user && user?.has_membership ? 10000 : 100;
    const chatLimitReached = chats.length >= chatLimit;
    const navigate = useNavigate();
    const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

    const fetchConnection = useCallback(async () => {
        try {
            const response = await api.get(`/get_connection/${connection_name}`);
            setConnection(response.data?.connection);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error getting connection');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [connection_name]);

    useEffect(() => {
        if (connection_name) {
            fetchConnection();
        }
    }, [connection_name, fetchConnection]);

    //Initialize chats from localStorage
    useEffect(() => {
        if (connection?.feed_id) {
            const storedChats = localStorage.getItem('connectionChats');
            if (storedChats) {
                const parsed = JSON.parse(storedChats);
                if (parsed[connection.feed_id]) {
                    setChats(parsed[connection.feed_id]);
                }
            }
        }
    }, [connection?.feed_id]);

    const updateLocalStorageChats = useCallback((connectionFeedId, newChats) => {
        const storedChats = localStorage.getItem('connectionChats');
        const parsed = storedChats ? JSON.parse(storedChats) : {};
        parsed[connectionFeedId] = newChats;
        localStorage.setItem('connectionChats', JSON.stringify(parsed));
    }, []);

    //Socket listener for real-time chat updates
    useEffect(() => {
        const socket = window.socket;
        if (!socket || !viewer?.feed_id) return;
        const handleNewChat = (data) => {
            if (data?.chat && connection?.feed_id) {
                setChats(prev => {
                    //Avoid duplicates
                    if (prev.some(c => c?.chat_id === data?.chat?.chat_id)) {
                        return prev;
                    }
                    const newChats = [data.chat, ...prev];
                    updateLocalStorageChats(connection?.feed_id, newChats);
                    return newChats;
                });
            }
        };
        const handleChatRemoved = (data) => {
            setChats(prev => {
                const newChats = prev.filter(chat => chat?.chat_id !== data?.chat_id);
                updateLocalStorageChats(connection?.feed_id, newChats);
                return newChats;
            });
            //If viewing deleted chat, redirect to Main
            if (selectedChatId === data?.chat_id) {
                const mainChat = chats.find(c => c?.title === 'Main');
                if (mainChat) {
                    navigate(`/connections/${connection_name}/${mainChat?.chat_id}`);
                }
            }
        };
        const handleChatNameChanged = (data) => {
            const { chat_id, new_title } = data;
            setChats(prevChats => {
                const newChats = prevChats.map(chat =>
                    chat.chat_id === chat_id ? {...chat, title: new_title} : chat
                );
                updateLocalStorageChats(connection?.feed_id, newChats);
                return newChats;
            });
            //Update current chat title if viewing the renamed chat
            if (selectedChatId === chat_id) {
                setCurrentChatTitle(new_title);
            }
        };
        socket.on('new_chat_created', handleNewChat);
        socket.on('chat_removed', handleChatRemoved);
        socket.on('chat_name_changed', handleChatNameChanged);
        return () => {
            socket.off('new_chat_created', handleNewChat);
            socket.off('chat_removed', handleChatRemoved);
            socket.off('chat_name_changed', handleChatNameChanged);
        };
    }, [connection?.feed_name, connection?.feed_id, viewer?.feed_id, selectedChatId, chats, connection_name, navigate, updateLocalStorageChats]);

    useEffect(() => {
        if (chats.length > 0) {
            if (chat_id) {
                const found = chats.find(c => c?.chat_id === chat_id);
                if (found) {
                    setSelectedChatId(found?.chat_id);
                    setCurrentChatTitle(found?.title);
                }
            } else {
                //If no chat_id, find and navigate to Main chat
                const mainChat = chats.find(c => c?.title === 'Main');
                if (mainChat) {
                    navigate(`/connections/${connection_name}/${mainChat?.chat_id}`, { replace: true });
                }
            }
        }
    }, [chat_id, chats, connection_name, navigate]);
    
    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChatName.length === 0) {
                setErrorMessage("Channel needs a name");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            if (newChatName === 'Main') {
                setErrorMessage("Channel cannot be named Main");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            } 
            const response = await api.post('/change_chat_name', {
                channelId: selectedChatId,
                newChannelName: newChatName, //Send plaintext
            });
            if (response.status === 200) {
                setErrorMessage('');
                setIsEditingChatName(false);
                setNewChatName('');
                setChats(prevChats => {
                    const newChats = prevChats.map(chat =>
                        chat?.chat_id === selectedChatId ? {...chat, title: newChatName} : chat
                    );
                    updateLocalStorageChats(connection?.feed_id, newChats);
                    return newChats;
                });
                setCurrentChatTitle(newChatName);
                navigate(`/connections/${connection_name}/${selectedChatId}`);
            }
        } catch (error){
            setErrorMessage(error.response.data?.message || "Error changing channel name");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const createNewChat = async (event) => {
        event.preventDefault();
        if (chats.length >= chatLimit) {
            setErrorMessage("Chat limit reached");
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return;
        }
        try {
            if (!connection) {
                setErrorMessage("No matching connection found");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            const participants = [
                { feed_id: viewer.feed_id },
                { feed_id: connection.feed_id }
            ];
            let finalChatName = "";
            const baseName = "New chat";
            if (newChatName.length === 0) {
                if (!chats.some(c => c?.title === baseName)) {
                    finalChatName = baseName;
                } else {
                    let counter = 2;
                    while (chats.some(c => c?.title === `${baseName} ${counter}`)) {
                        counter++;
                    }
                    finalChatName = `${baseName} ${counter}`;
                }
            } else {
                finalChatName = newChatName;
                if (chats.some(c => c?.title === finalChatName)) {
                    setErrorMessage("Name already used");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
            }
            if (finalChatName.length >= 30) {
                setErrorMessage("Name too long");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            if (finalChatName === 'Main') {
                setErrorMessage("Cannot be named Main");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            const response = await api.post('/create_chat', {
                participants,
                title: finalChatName //Send plaintext
            });
            if (response.data && response.status === 201) {
                const newChat = response.data?.newChat;
                //Backend already returns decrypted title, no need to decrypt
                const updatedChats = [newChat, ...chats];
                setChats(updatedChats);
                updateLocalStorageChats(connection?.feed_id, updatedChats);
                setErrorMessage('');
                setNewChatName('');
                setShowForm(false);
                const socket = window.socket;
                if (socket) {
                    socket.emit('chat_created', {
                        chat: newChat,
                        connection_feed_id: connection?.feed_id
                    });
                }
                navigate(`/connections/${connection_name}/${newChat?.chat_id}`);
            } else {
                setErrorMessage("Failed to create chat");
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || "Failed to create chat");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const deleteChat = async () => {
        if (window.confirm(`Are you sure you want to delete ${currentChatTitle}?`)) {
            try {
                if (currentChatTitle === 'Main') {
                    setErrorMessage("Main chat cannot be deleted.");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
                const response = await api.delete('/delete_chat', { data: { channelId: selectedChatId } });
                if (response.data?.success) {
                    setChats(prevChats => {
                        const newChats = prevChats.filter(chat => chat?.chat_id !== selectedChatId);
                        updateLocalStorageChats(connection?.feed_id, newChats);
                        return newChats;
                    });
                    //Emit socket event to notify other user
                    const socket = window.socket;
                    if (socket) {
                        socket.emit('chat_deleted', {
                            chat_id: selectedChatId,
                            connection_feed_id: connection?.feed_id
                        });
                    }
                    const mainChat = chats.find(c => c?.title === 'Main');
                    if (mainChat) {
                        navigate(`/connections/${connection_name}/${mainChat?.chat_id}`);
                    }
                }
            } catch (error) {
                setErrorMessage(error.response.data?.message || 'Error deleting channel');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        }
    };

    const toggleForm = () => { setShowForm(!showForm) }

    const updateChats = useCallback((newChats) => {
        setChats(newChats);
    }, []);
 
    document.title = connection_name;
    return (
        <div className="standard-container">
            <ChatChannel canAdd={true} channelId={selectedChatId} connection={connection} isGroup={false} isLocked={false} setChats={setChats} setErrorMessage={setErrorMessage} />
            <SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
                {connection && (
                    <div className="feed-summary">
                        <Link className="chat-feed-link" to={`/u/${connection_name}`}>
                            <img className="small-feed-photo" src={`${connection?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                            <p className="feed-list-text">{connection_name}</p>
                        </Link>
                        <div className="channel-name-section">
                        {currentChatTitle !== "Main" ? (
                            <>
                                {isEditingChatName ? (
                                    <div className="change-name">
                                        <textarea
                                            className="change-name-area"
                                            value={newChatName}
                                            placeholder="New name"
                                            onChange={(e) => {
                                                e.preventDefault();
                                                const input = e.target.value;
                                                if (input.length <= 30) {
                                                    setNewChatName(input);
                                                    setErrorMessage("");
                                                } else {
                                                    setErrorMessage("Name too long");
                                                }
                                            }}
                                        />
                                        <div className="cancel-save">
                                            <button className="small-icon" onClick={() => {setIsEditingChatName(false); setNewChatName(""); setErrorMessage("");}} title="Cancel">
                                                <FaRegWindowClose />
                                            </button>
                                            <button className="small-icon" onClick={(e) => {e.preventDefault(); changeChannelName(e);}} title="Save">
                                                <FaSave />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="large-text">{currentChatTitle}</p>
                                        <div className="button-group">
                                            <button className="small-icon" onClick={() => {setIsEditingChatName(true); setNewChatName(currentChatTitle);}} title="Edit chat name">
                                                <FaEdit />
                                            </button>
                                            <button className="small-icon" onClick={deleteChat} title="Delete chat">
                                                <FaTrash />
                                            </button>
                                            <button className="small-icon" onClick={toggleForm} title={showForm ? "Close" : "Create chat"} >
                                                {showForm ? <FaMinus /> : <FaPlus />}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                            ) : (
                                <>
                                    <p className="large-text">Main</p>
                                    <div className="button-group">
                                        <button className="small-icon" onClick={toggleForm} title={showForm ? "Close" : "Create chat"} >
                                            {showForm ? <FaMinus /> : <FaPlus />}
                                        </button>
                                    </div>
                                </>
                            )}
                            {showForm && (
                                <>
                                {chatLimitReached && <div className="error-message">Chat limit reached</div>}
                                <form className="add-channel-form" onSubmit={createNewChat}>
                                    <input
                                        className="name-input"
                                        type="text"
                                        name="chat_name"
                                        placeholder="Chat name..."
                                        value={newChatName}
                                        onChange={(e) => {
                                            e.preventDefault();
                                            const input = e.target.value;
                                            if (input.length <= 30) {
                                                setNewChatName(input);
                                                if (input.trim() === 'Main') {
                                                    setErrorMessage("Cannot be named Main");
                                                } else {
                                                    setErrorMessage("");
                                                }
                                            } else {
                                                setErrorMessage("Name too long");
                                            }
                                        }}
                                    />
                                    <button className={`small-icon ${chatLimitReached ? 'disabled' : ''}`} type="submit" disabled={chatLimitReached} title="Create chat">
                                        <FaPlus />
                                    </button>
                                </form>
                                </>
                            )}
                            <div className="error-message">{errorMessage}</div>
                        </div>
                        <ChannelList channels={chats} feedId={viewer?.feed_id} feedName={connection?.feed_name} isChat={true} isGroup={false} setChannels={updateChats} />
                    </div>
                )}
            </SwipeableAside>
        </div>
    );       
};

export default ChatPage;