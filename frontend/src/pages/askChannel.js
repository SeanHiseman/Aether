import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';

function AskChannel() {
    const [channel, setChannel] = useState([]);
    const [chats, setChats] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const location = useLocation();
    const query = location.state?.query || '';
    const [selectedChats, setSelectedChats] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState(null);    
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    //Get users previous Ask chats
    useEffect(() => {
        const fetchChats = async () => {
            try {
                const response = await axios.get('/api/get_ask_chats');
                console.log("response:", response);
                setChats(response.data.chats);
            } catch (error) {
                setErrorMessage('Error fetching chats');
            }
        };
        fetchChats();
    }, []);

    const createNewAskChat = async (event) => {
        event.preventDefault();
        try {
            const newChatId = v4();
            const response = await axios.post('/api/create_ask_chat', {
                chatId: newChatId,
                name: "New chat"
            });
            if (response.data && response.status === 201) {
                const newChat = {
                    ...response.data,
                    chatId: response.data.newChat.chat_id,
                };
                //Updates chats and viewed chats
                setChats(prevChats => [...prevChats, newChat]);
                setSelectedChats(prevSelected => [...prevSelected, newChat]);
                setSelectedChatId(newChat.chatId);
                navigate(`/ask/${newChat.chatId}`)
                setErrorMessage('');
            } else {
                setErrorMessage("Failed to add chat");
            }
        } catch (error) {
            setErrorMessage("Failed to add chat");
        }
    };

    const sendAskMessage = () => {
        try{
            setCurrentMessage('');
        } catch {
            setErrorMessage("Error sending message");
        }
    };

    document.title="Ask";
    return (
        <div className="results-container">  
            <div className="content-feed">
                <div className="channel-feed">
                    <div id="channel">
                        <div className="channel-content messages">
                            <div className="message-container outgoing">
                                <div className="message outgoing">
                                    {query}
                                </div>
                            </div>
                            {!user.hasMembership ? (
                                <div className="message-container incoming">
                                    <div className="message incoming">
                                        Only members can use Ask. Get membership here:
                                    </div>
                                    <button className="button join-small">Join</button>
                                </div>
                            ) : (
                                <p>Hello</p>
                            )}
                        </div>
                        <div id="channel-input">
                            <input class="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Ask..." onKeyDown={(e) => e.key === 'Enter' && sendAskMessage()}/>
                            <button class="chat-send-button" onClick={sendAskMessage}>Send</button>
                        </div>
                    </div>
                </div>
            </div>
            <aside id="right-aside">
                <p className="large-text">Ask</p>
                <div class="error-message">{errorMessage}</div>
                <div id="add-chat-section">
                    <div id="add-channel-section">
                        <button class="button" onClick={createNewAskChat}>New chat</button>
                    </div>
                </div>
                <ul>
                    {chats.map(chat => (
                        <li key={chat.chat_id} className="channel-item">
                            <Link to={`/ask/${chat.chat_id}`}>
                                {chat.name || "New chat"}
                            </Link>
                        </li>
                    ))}
                </ul>
            </aside>
        </div>
    );
}
export default AskChannel;