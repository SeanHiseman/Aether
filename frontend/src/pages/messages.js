import axios from 'axios';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../components/authContext';
import { io } from "socket.io-client";
import { Link, useNavigate, useParams } from 'react-router-dom';
import PostForm from '../components/postForm';

function MessagesPage() {
    const [chat, setChat] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [friends, setFriends] = useState([]);
    const { friend_name, username, title } = useParams();
    const [message, setMessage] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [selectedConversations, setSelectedConversations] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const socketRef = useRef(null);
    const { user } = useContext(AuthContext)
    const navigate = useNavigate();

    useEffect(() => {
        fetch('/api/get_friends')
            .then(response => response.json())
            .then(data => setFriends(data))
            .catch(error => console.log("Error fetching friends", error));
        
        fetch(`/api/get_conversations`)
            .then(response => response.json())
            .then(data => setConversations(data))
            .catch(error => console.log("Error fetching conversations", error));
        socketRef.current = io(`http://localhost:7000`);

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);
    
    //Filters conversations to those with a specific friend
    useEffect(() => {
        if (conversations.length > 0 && friend_name) {
            const filteredConversations = conversations.filter(conversation =>
                conversation.participants.map(p => p.username).includes(friend_name));
            setSelectedConversations(filteredConversations);

            if (title) {
                const selected = filteredConversations.find(c => c.title === title);
                if (selected) {
                    setSelectedConversationId(selected.conversationId);
                }
            } else if (filteredConversations.length > 0) {
                //Default to first conversation if none given
                setSelectedConversationId(filteredConversations[0].conversationId);
            }
        }
    }, [friend_name, conversations, user?.username, title]);

    useEffect(() => {
        //Get existing messages
        if (selectedConversationId){
            //Join conversation room 
            socketRef.current.emit('join_conversation', selectedConversationId);

            const handleReceiveMessage = (message) => {
                setChat(prevChat => [...prevChat, message]);
            };

            //Listen for incoming messages
            socketRef.current.on('receive_message', handleReceiveMessage);

            getChatMessages(selectedConversationId);

            return () => {
                socketRef.current.emit('leave_conversation', selectedConversationId);
                socketRef.current.off('receive_message', handleReceiveMessage);
            };
        }
    }, [selectedConversationId]);

    const createNewChat = async (event) => {
        event.preventDefault();
        try {
            //Get friend_id
            const friend = friends.find(f => f.friend_name === friend_name);
            const friendId = friend.friend_id;
            const participants = [user.userId, friendId];
            const response = await axios.post('/api/create_conversation', {
                participants: participants,
                title: newChatName
            });
            if (response.data && response.status === 201) {
                navigate(`/messages/${username}/${friend_name}/${newChatName}`)
                setErrorMessage('');
                setNewChatName('');
            } else {
                setErrorMessage("Failed to add chat.");
            }
        } catch (error) {
            console.error("Error creating chat:", error);
            setErrorMessage("Failed to create chat.");
        }
    };

    //Get messages from a specific conversation
    const getChatMessages = (conversationId) => {
        fetch(`/api/get_chat_messages/${conversationId}`)
            .then(response => response.json())
            .then(data => setChat(data))
            .catch(error => console.log("Error fetching chat messages", error));
    }
    const sendMessage = () => {
        if (socketRef.current) {
            //Emits new message to server
            const newMessage = {
                content: message,
                senderId: user.userId,
                conversationId: selectedConversationId,
            };
            socketRef.current.emit('send_message', newMessage);
            setChat(prevChat => [...prevChat, newMessage]);
            setMessage('');
        }
    };

    const toggleForm = () => {
        setShowForm(!showForm)
    }

    //Gets profile photo of viewed friend
    const friendProfileImage = friends.find(friend => friend.friend_name === friend_name)?.friend_profile_photo || '';
    
    document.title = "Messages";
    return (
        <div className="messages-container">
            <div className="content-feed">
                <header id="messages-header">
                    {selectedConversationId ? (
                        <h1>{selectedConversations.find(c => c.conversationId === selectedConversationId)?.title || 'Conversation'}</h1>
                    ) : <h1>Friends</h1>}
                </header>
                <div id="channel-content">
                    {!friend_name ? (
                        <ul>
                            {friends.map(friend => (
                                <li key={friend.friend_id}>
                                    <Link to={`/profile/${friend.friend_name}`}>
                                        {friend.friend_name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        chat.map((msg, index) => (
                            <div key={index} className={`message ${msg.senderId === user.userId ? 'outgoing' : 'incoming'}`}>
                                {msg.content}
                            </div>
                        ))
                    )}
                </div>
                {friend_name && (
                    <div id="channel-input">
                        <PostForm />
                        <input className="chat-message-bar" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                        <button className="chat-send-button" onClick={sendMessage}>Send</button>
                    </div>
                )}
            </div>
            <aside id="right-aside">
                {friend_name ? (
                    <nav id="friend-list">
                        <Link id="chat-profile-link" to={`/profile/${friend_name}`}>
                            <img className="profile-image2" src={`/${friendProfileImage}`} alt="Profile image"/>
                            <h1>{friend_name}</h1>
                        </Link>
                        <h2>Chats</h2> 
                        <ul>
                            {selectedConversations.map(conversation => (
                                <li key={conversation.conversationId}>
                                    <Link to={`/messages/${username}/${friend_name}/${conversation.title}`}>
                                        <div className="chat-link">{conversation.title}</div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div id="add-channel-section">
                            <button class="button" onClick={toggleForm}>
                                {showForm ? 'Close': 'Add chat'}
                            </button>
                            {showForm && (
                                <form id="add-chat-form" onSubmit={createNewChat}>
                                    <input className="channel-input" type="text" name="chat_name" placeholder="Chat name..." value={newChatName} onChange={(e) => setNewChatName(e.target.value)}/>
                                    <input className="button" type="submit" value="Add" disabled={!newChatName}/>
                                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                                </form>                            
                            )}
                        </div>
                    </nav>
                    ) : (
                        <nav id="friend-list">
                            <h2>Messages</h2>
                            <ul>
                                {friends.map(friend => (
                                    <li className="profile-info" key={friend.friend_id}>
                                        <Link className="profile-link" to={`/messages/${username}/${friend.friend_name}`}>
                                        <img className="profile-image" src={`/${friend.friend_profile_photo}`} alt="Profile image"/>
                                            <div className="chat-username">
                                                {friend.friend_name}
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