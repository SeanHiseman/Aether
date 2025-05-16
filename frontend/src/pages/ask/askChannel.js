import axios from 'axios';
import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../../components/authContext';
import { useQueryContext } from '../../components/search/queryContext';
import { FaEdit, FaTrash, FaPlus, FaMinus } from 'react-icons/fa';

const AskChannel = () => {
	const { user } = useContext(AuthContext);   
	const [changedChatName, setChangedChatName] = useState('');
	const [chats, setChats] = useState([]);
	const [currentMessage, setCurrentMessage] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [isEditingChatName, setIsEditingChatName] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const maxLength = user.has_membership ? 100000 : 1000;
	const [messages, setMessages] = useState([]);
	const [newChatName, setNewChatName] = useState('');
	const [showNewChatForm, setShowNewChatForm] = useState(false);
	const location = useLocation();
	const { chatId } = useParams();
	const { query, setQuery } = useQueryContext(); 
	const navigate = useNavigate();
	const initialMessageRef = useRef(false);
	const usageLimit = user.has_membership ? 25000000 : 2500000;
	const limitReached = user.usage_count >= usageLimit ? true : false;

	useEffect(() => {
		const fetchChats = async () => {
			try {
				const response = await axios.get('/api/get_ask_chats');
				setChats(response.data.chats);
			} catch (error) {
				setErrorMessage('Error fetching chats');
				setTimeout(() => { setErrorMessage(''); }, 5000);
			}
		};
		fetchChats();
	}, []);

	useEffect(() => {
		const fetchMessages = async () => {
			try {
				if (chatId) {
					if (location.state?.initialMessage && !initialMessageRef.current) {
						if (limitReached) {
							setErrorMessage(user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
							setTimeout(() => { setErrorMessage(''); }, 10000);
							return;
						}
						initialMessageRef.current = true; 
						await sendAskMessage(chatId, location.state.initialMessage);
					} else if (query.length !== 0) {
						if (limitReached) {
							setErrorMessage(user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
							setTimeout(() => { setErrorMessage(''); }, 10000);
							return;
						}
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
				setTimeout(() => { setErrorMessage(''); }, 5000);
			}
		};
		fetchMessages();
	}, [chatId, limitReached, query, setQuery, user.user_id, location.state]);

	const currentChat = chats.find(chat => chat.chat_id === chatId);
	const chatName = currentChat ? currentChat.name : 'Ask';

	const changeChatName = async (event) => {
		event.preventDefault();
		try {
			if (changedChatName.trim().length === 0) {
				setErrorMessage("Chat needs a name");
				setTimeout(() => { setErrorMessage(''); }, 5000);
				return;
			}
			if (changedChatName.trim() === 'Ask') {
				setErrorMessage("Chat cannot be named Ask");
				setTimeout(() => { setErrorMessage(''); }, 5000);
				return;
			}
			if (changedChatName.trim().length > 30) {
				setErrorMessage("Name too long");
				setTimeout(() => { setErrorMessage(''); }, 5000);
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
			setTimeout(() => { setErrorMessage(''); }, 5000);
		}
	};

	const createNewAskChat = async (messageContent = '') => {
		try {
			const newChatId = v4();
			let finalChatName = "";
			const baseName = "New chat";
			if (newChatName.trim().length === 0) {
				if (!chats.some(c => c.name === baseName)) {
					finalChatName = baseName;
				} else {
					let counter = 2;
					while (chats.some(c => c.name === `${baseName} ${counter}`)) {
						counter++;
					}
					finalChatName = `${baseName} ${counter}`;
				}
			} else {
				finalChatName = newChatName.trim();
				if (chats.some(c => c.name === finalChatName)) {
					setErrorMessage("Name already used");
					setTimeout(() => { setErrorMessage(''); }, 5000);
					return;
				}
			}
			if (finalChatName.length > 30) {
				setErrorMessage("Name too long");
				setTimeout(() => { setErrorMessage(''); }, 5000);
				return;
			}
			const response = await axios.post('/api/create_ask_chat', {
				chatId: newChatId,
				chatName: finalChatName
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
				setTimeout(() => { setErrorMessage(''); }, 5000);
			}
		} catch (error) {
			setErrorMessage("Error creating chat");
			setTimeout(() => { setErrorMessage(''); }, 5000);
		}
	};

	const deleteChat = async () => {
		if (window.confirm(`Are you sure you want to delete ${chatName}?`)) {
			try {
				await axios.delete('/api/delete_ask_chat', { data: { chat_id: chatId } });
				setChats(prevChats => prevChats.filter(chat => chat.chat_id !== chatId));
				navigate('/ask/home');
			} catch (error) {
				setErrorMessage('Error deleting chat');
				setTimeout(() => { setErrorMessage(''); }, 5000);
			}
		}
	};

	const handleHomeSubmit = async (event) => {
		event.preventDefault();
		if (limitReached) {
			setErrorMessage(user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
			return;
		}
		try {
			await createNewAskChat(currentMessage);
			setCurrentMessage('');
		} catch (error) {
			setErrorMessage("Error submitting chat");
			setTimeout(() => { setErrorMessage(''); }, 5000);
		}
	};

	const isHome = location.pathname === '/ask/home';

	const sendAskMessage = async (chatId, messageContent = currentMessage) => {
		if (limitReached) {
			setErrorMessage(user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
			return;
		}
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
				setTimeout(() => { setErrorMessage(''); }, 5000);
			}
		} catch (error) {
			setErrorMessage("Error sending message");
			setTimeout(() => { setErrorMessage(''); }, 5000);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateChat = async (event) => {
		event.preventDefault();
		if (newChatName.trim().length > 30) {
			setErrorMessage("Chat name too long");
			setTimeout(() => { setErrorMessage(''); }, 5000);
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
                                    placeholder={limitReached ? (user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more.") : "Ask..."} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleHomeSubmit(e)}
                                    disabled={isLoading || limitReached}
                                />
                                <button className={isLoading || limitReached ? "chat-send-button disabled" : "chat-send-button"} onClick={handleHomeSubmit} disabled={isLoading || limitReached}>
                                    {isLoading ? 'Loading...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel">
                            <div className="channel-content messages">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`message-container ${msg.sender_id === user.user_id ? 'outgoing' : 'incoming'}`}>
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
									placeholder={limitReached ? (user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more.") : "Ask..."}
									onChange={(e) => {
										const input = e.target.value;
										if (input.length <= maxLength) {
											setCurrentMessage(input);
											setErrorMessage('');
										} else {
											setErrorMessage(`${maxLength} character limit.`, !user.has_membership && "Get membership for more.");
										}
									}}
									onKeyDown={(e) => e.key === 'Enter' && sendAskMessage(chatId, currentMessage)} 
									disabled={isLoading || limitReached}
								/>
                                <button className={isLoading || limitReached ? "chat-send-button disabled" : "chat-send-button"} onClick={() => sendAskMessage(chatId, currentMessage)} disabled={isLoading || limitReached}>
                                    {isLoading ? 'Loading...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
			</div>
            <aside className="right-aside">
                <div className="error-message">{errorMessage}</div>
                {chatName !== 'Ask' ? (
                    <div id="chat-change">
                        <p className="text36">{chatName}</p>
                        {isEditingChatName ? (
                            <div className="change-name">
                                <textarea 
                                    className="change-name-area" 
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
                                <div className="cancel-save">
                                    <button className="button" type="button" onClick={() => { setIsEditingChatName(false); setChangedChatName(''); setErrorMessage(''); }}>
                                        Cancel
                                    </button>
                                    <button className="button" type="submit" onClick={changeChatName}>
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="button-group">
                                <button className="small-icon" onClick={() => { setIsEditingChatName(true); setChangedChatName(chatName); }}>
                                    <FaEdit />
                                </button>
                                <button className="small-icon" onClick={deleteChat}>
                                    <FaTrash />
                                </button>
                                <button className="small-icon" onClick={toggleNewChatForm}>
                                    {showNewChatForm ? <FaMinus /> : <FaPlus />}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="text36">{chatName}</p>
                        <div className="button-group">
                            <button className="small-icon" onClick={toggleNewChatForm}>
                                {showNewChatForm ? <FaMinus /> : <FaPlus />}
                            </button>
                        </div>
                    </>
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
                        />
                        <button className="small-icon" type="submit">
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
		</div>
	);
};

export default AskChannel;
