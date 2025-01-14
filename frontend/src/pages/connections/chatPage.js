import axios from 'axios';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ChannelName from '../../components/channels/channelName';
import ChatChannel from '../../components/channels/chatChannel';
import { decrypt, encrypt } from '../../encryptionUtil';

const ChatPage = () => {
    const { connection_name, title } = useParams();
    const [connection, setConnection] = useState(null);
    const [chats, setChats] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const { viewer } = useContext(AuthContext);
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
    
    const toggleForm = () => { setShowForm(!showForm) }

    const updateChats = useCallback((newChats) => {
        setChats(newChats);
    }, []);
 
    document.title = connection_name;
    return (
        <div className="standard-container">
            <ChatChannel channelId={selectedChatId} connection={connection} isGroup={false} setChats={setChats} setErrorMessage={setErrorMessage} />
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
