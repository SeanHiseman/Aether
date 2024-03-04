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
    const { friend_name, username } = useParams();
    const [message, setMessage] = useState('');
    const [newChatName, setNewChatName] = useState('');
    const [selectedConversations, setSelectedConversations] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const socketRef = useRef(null);
    const { user } = useContext(AuthContext)
    const navigate = useNavigate;

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
    
    useEffect(() => {
        if(friend_name && user?.username) {
            const filteredConversations = conversations.filter(conversation => {
                const participantUsernames = conversation.participants.map(p => p.username);
                return participantUsernames.includes(friend_name) && participantUsernames.includes(user.username);
            });
            setSelectedConversations(filteredConversations);
            setSelectedConversationId(filteredConversations[0].conversationId);
        }
    }, [friend_name, conversations, user?.username]);

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

            fetch(`/api/get_chat_messages/${selectedConversationId}`)
                .then(response => response.json())
                .then(data => setChat(data))
                .catch(error => console.log("Error fetching chat messages", error));
            return () => {
                socketRef.current.emit('leave_conversation', selectedConversationId);
                socketRef.current.off('receive_message', handleReceiveMessage);
            };
        }
    }, [selectedConversationId]);

    const createNewChat = () => {
        //Get friend_id
        const friend = friends.find(f => f.friend_name === friend_name);
        const friendId = friend.friend_id;
        const participants = [user.userId, friendId];

        fetch('/api/create_conversation', {
            method: 'POST',
            body: JSON.stringify({ participants }),
        })
        .then(response => response.json())
        .then(data => {navigate(`/messages/${username}/${friend_name}/${newChatName}`)})
        .catch((error) => {console.error('Error:', error)})
    };

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
                <h2>{friend_name ? "Conversations" : "Messages"}</h2>
                <nav id="friend-list">
                    {friend_name ? (
                        <ul>
                            <Link className="profile-link" to={`/profile/${friend_name}/main`}>
                                <img className="profile-image2" src={`/${friendProfileImage}`} alt="Profile image"/>
                                <h1>{friend_name}</h1>
                            </Link>
                            {selectedConversations.map((conversation, index) => (
                                <li key={conversation.conversationId}>
                                    <Link to={`/messages/${username}/${friend_name}/${conversation.title}`}>
                                        <button className="conversation-button">{conversation.title}</button>
                                    </Link>
                                </li>
                            ))}
                            <div id="add-channel-section">
                                <button class="button" onClick={toggleForm}>
                                    {showForm ? 'Close': 'Create new chat'}
                                </button>
                                {showForm && (
                                    <form id="add-channel-form" onSubmit={createNewChat}>
                                        <input className="channel-input" type="text" name="chat_name" placeholder="Chat name..." value={newChatName} onChange={(e) => setNewChatName(e.target.value)}/>
                                        <input className="button" type="submit" value="Add" disabled={!newChatName}/>
                                        {errorMessage && <div className="error-message">{errorMessage}</div>}
                                    </form>                            
                                )}
                            </div>
                        </ul>
                    ) : (
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
                    )}
                </nav>
            </aside>
        </div>
    );
}

export default MessagesPage;