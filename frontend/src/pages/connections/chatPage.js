import axios from 'axios';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { FaEdit, FaMinus, FaPlus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ChatChannel from '../../components/channels/chatChannel';
import { decrypt, encrypt } from '../../encryptionUtil';

const ChatPage = () => {
    const { connection_name, title } = useParams(); //The chat name is referred to as 'title' in the database, but 'chatName' in the frontend. May fix later.
    const [connection, setConnection] = useState(null);
    const [chats, setChats] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const { user, viewer } = useContext(AuthContext);
    const chatLimit = user && user.has_membership ? 10000 : 100;
    const chatLimitReached = chats.length >= chatLimit;
    const navigate = useNavigate();
    const { rightClasses } = useOutletContext(); 

    const fetchConnection = async () => {
        try {
            const response = await axios.get(`/api/get_connection/${connection_name}`);
            setConnection(response.data.connection); 
        } catch (error) {
            setErrorMessage('Error getting connection');
            setTimeout(() => { setErrorMessage(''); }, 5000);
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
    
    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChatName.length === 0) {
                setErrorMessage("Channel needs a name");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            //Names over 30 characters already prevented
            }
            if (newChatName === 'Main') {
                setErrorMessage("Channel cannot be named Main");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            } 
            let finalChannelName = newChatName;
            const encryptedChannelName = encrypt(newChatName);
            finalChannelName = encryptedChannelName;
            const response = await axios.post('/api/change_chat_name', {
                channelId: selectedChatId,
                newChannelName: finalChannelName,
            });
            if (response.status === 200) {
                setErrorMessage('');
                setIsEditingChatName(false);
                setNewChatName('');
                setChats(prevChats => 
                    prevChats.map(chat =>
                        chat.chat_id === selectedChatId ? {...chat, title: newChatName} : chat
                    )
                );
                navigate(`/connections/${connection_name}/${newChatName}`);
            }
        } catch {
            setErrorMessage("Error changing channel name");
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
                if (!chats.some(c => c.title === baseName)) { //If no chats have the default name
                    finalChatName = baseName;
                } else {
                    let counter = 2; //Allows for 'New chat 2', 'New chat 3' etc
                    while (chats.some(c => c.title === `${baseName} ${counter}`)) {
                        counter++;
                    }
                    finalChatName = `${baseName} ${counter}`;
                }
            } else {
                finalChatName = newChatName;
                if (chats.some(c => c.title === finalChatName)) {
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
            const encryptedChatName = encrypt(finalChatName);
            const response = await axios.post('/api/create_chat', {
                participants,
                title: encryptedChatName
            });
            if (response.data && response.status === 201) {
                const newChat = response.data.newChat;
                const decryptedTitle = decrypt(newChat.title);
                const updatedChats = [{ ...newChat, title: decryptedTitle }, ...chats];
                setChats(updatedChats);
                setErrorMessage('');
                setNewChatName('');
                setShowForm(false);
                navigate(`/connections/${connection_name}/${finalChatName}`);
            } else {
                setErrorMessage("Failed to create chat");
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        } catch (error) {
            setErrorMessage("Failed to create chat");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${title}?`)) {
            try {
                if (title === 'Main') {
                    setErrorMessage("Main chat cannot be deleted.");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
                const response = await axios.delete('/api/delete_chat', { data: { channelId: selectedChatId } });
                if (response.data.success) {
                    setChats(prevChats => prevChats.filter(chat => chat.chat_id !== selectedChatId));
                    navigate(`/connections/${connection_name}/Main`);
                }
            } catch (error) {
                setErrorMessage('Error deleting channel');
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
            <aside className={rightClasses}>
                {connection && (
                    <div id="feed-summary">
                        <Link className="chat-feed-link" to={`/u/${connection_name}`}>
                            <img className="small-feed-photo" src={`/${connection.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                            <p className="feed-list-text">{connection_name}</p>
                        </Link>
                        <div className="channel-name-section">
                        {title !== "Main" ? (
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
                                        <p className="text36">{title}</p>
                                        <div className="button-group">
                                            <button className="small-icon" onClick={() => {setIsEditingChatName(true); setNewChatName(title);}} title="Edit chat name">
                                                <FaEdit />
                                            </button>
                                            <button className="small-icon" onClick={handleDelete} title="Delete chat">
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
                                    <p className="text36">Main</p>
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
                        <ChannelList channels={chats} feedId={viewer.feed_id} feedName={connection.feed_name} isChat={true} isGroup={false} setChannels={updateChats} />
                    </div>
                )}
            </aside>
        </div>
    );       
};

export default ChatPage;