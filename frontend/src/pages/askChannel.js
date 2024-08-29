import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';

function AskChannel() {
    const [changedChatName, setChangedChatName] = useState('');
    const [chats, setChats] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChatName, setIsEditingChatName] = useState(false);
    const [messages, setMessages] = useState([]);
    const location = useLocation();
    const query = location.state?.query || '';
    const navigate = useNavigate();
    const { chatId } = useParams();
    const { user } = useContext(AuthContext);

    //Get user's previous Ask chats
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

    //Get messages from current chat
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                //Home chat doesn't have ID or messages
                if (chatId) {
                    const response = await axios.get('/api/get_ask_messages', { params: { chatId } });
                    setMessages(response.data.messages);
                }
            } catch (error) {
                setErrorMessage('Error getting messages');
            }
        };
        fetchMessages();
    }, [chatId]);

    //Find current chat based on Id in url
    const currentChat = chats.find(chat => chat.chat_id === chatId);
    const chatName = currentChat ? currentChat.name : 'Home';

    const changeChatName = async (event) => {
        event.preventDefault();
        try {
            if (changedChatName.length === 0) {
                setErrorMessage("Chat needs a name");
                return;
            } else {
                const response = await axios.post('/api/change_ask_chat_name', {
                    chatId: chatId,
                    newName: changedChatName
                });
            }
        } catch {
            setErrorMessage("Error changing chat name");
        }
    };

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
                    chatId: response.data.chat_id,
                };
                //Updates chats and viewed chats
                setChats(prevChats => [...prevChats, newChat]);
                navigate(`/ask/${newChat.chatId}`)
                setErrorMessage('');
            } else {
                setErrorMessage("Failed to add chat");
            }
        } catch (error) {
            setErrorMessage("Failed to add chat");
        }
    };

    const deleteChat = async () => {
        try {
            await axios.delete('/api/delete_ask_chat', { data: {chat_id: chatId } });
            //Show chat list without deleted chat
            setChats(prevChats => 
                prevChats.filter(chat => chat.chat_id !== chatId)
            );
            navigate('/ask/home');
        } catch (error) {
            setErrorMessage('Error deleting chat:', error);
        }
    };

    //If user is submitting a query through the home chat
    const handleHomeSubmit = async (event) => {
        event.preventDefault();
        try {
            //if (currentMessage.trim()) {
                //await createNewAskChat(currentMessage.trim());
                setCurrentMessage('');
            //}
        } catch (error) {
            setErrorMessage("Error submitting chat");
        }
    };

    //Checks if viewing home chat
    const isHome = location.pathname === '/ask/home';

    const sendAskMessage = async () => {
        try {
            const response = await axios.post('/api/send_ask_message', {
                chatId: chatId,
                messageContent: currentMessage,
                senderId: user.userId, 
            });

            if (response.data && response.status === 201) {
                setMessages(prevMessages => [response.data.message, ...prevMessages]);
                setCurrentMessage('');
                setErrorMessage('');
            } else {
                setErrorMessage("Failed to send message");
            }
        } catch (error) {
            setErrorMessage("Error sending message");
        }
    };

    document.title="Ask";
    return (
        <div className="results-container">  
            <div className="content-feed">
                {!user.hasMembership ? (
                    <div className="message-container incoming">
                        <div className="message incoming">
                            Only members can use Ask. Get membership here:
                        </div>
                        <button className="button join-small">Join</button>
                    </div>
                ) : (
                    <div className="channel-feed">
                        {isHome ? (
                            <div id="channel">
                                <div className="channel-content">
                                    <p className="text36">Ask anything...</p>
                                </div>
                                <div id="channel-input">
                                    <input class="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Ask..." onKeyDown={(e) => e.key === 'Enter' && handleHomeSubmit()}/>
                                    <button class="chat-send-button" onClick={handleHomeSubmit}>Send</button>
                                </div>
                            </div>
                        ) : (
                            <div id="channel">
                                <div className="channel-content messages">
                                    {messages.map((msg, index) => (
                                        <div key={index} className={`message-container ${msg.sender_id === user.userId ? 'outgoing' : 'incoming'}`}>
                                            <div className={`message ${msg.sender_id === user.userId ? 'outgoing' : 'incoming'}`}>
                                                {msg.message_content}
                                            </div>
                                        </div>  
                                    ))}
                                </div>
                                <div id="channel-input">
                                    <input class="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Ask..." onKeyDown={(e) => e.key === 'Enter' && sendAskMessage()}/>
                                    <button class="chat-send-button" onClick={sendAskMessage}>Send</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {!user.hasMembership ? (
                <aside id="right-aside">
                    <p className="large-text">Ask</p>
                </aside>
            ) : (
                <aside id="right-aside">
                    <div class="error-message">{errorMessage}</div>
                    {chatName !== 'Home' ? (
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
                                    <p className="large-text">{chatName}</p>
                                    <button className="button" onClick={() => {
                                        setIsEditingChatName(true);
                                        setChangedChatName(chatName);
                                    }}>Change name</button>
                                    <button className="button" onClick={() => deleteChat()}>Delete chat</button> 
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="large-text">{chatName}</p>
                    )}
                    <div id="add-chat-section">
                        <div id="add-channel-section">
                            <button class="button" onClick={createNewAskChat}>New chat</button>
                        </div>
                    </div>
                    <ul>
                        <li className="channel-item">
                            <Link to='/ask/home'>
                                <div className="channel-link">Home</div>
                            </Link>
                        </li>
                        {chats.map(chat => (
                            <li key={chat.chat_id} className="channel-item">
                                <Link to={`/ask/${chat.chat_id}`}>
                                    <div className="channel-link">{chat.name || "New chat"}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </aside>
            )}
        </div>
    );
}

export default AskChannel;