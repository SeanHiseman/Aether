import React, { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../components/authContext';
import { io } from "socket.io-client";
import { Link, useParams } from 'react-router-dom';
import PostForm from '../components/postForm';

function MessagesPage() {
    const [chat, setChat] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [friends, setFriends] = useState([]);
    const { friend_name, username } = useParams();
    const [message, setMessage] = useState('');
    const [selectedConversations, setSelectedConversations] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const socketRef = useRef(null);
    const { user } = useContext(AuthContext)

    useEffect(() => {
        fetch('/api/get_friends')
            .then(response => response.json())
            .then(data => setFriends(data))
            .catch(error => console.log("Error fetching friends", error));
        
        fetch(`/api/get_conversations`)
            .then(response => response.json())
            .then(data => {
                setConversations(data);
            })
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

    const sendMessage = () => {
        if (socketRef.current) {
            //Emits new message to server
            const newMessage = {
                content: message,
                senderId: user.user_id,
                conversationId: selectedConversationId,
            };
            socketRef.current.emit('send_message', newMessage);
            setMessage('');
        }
    };

    document.title = "Messages";
    return (
        <div className="messages-container">
            <div className="content-feed">
                <header id="messages-header">
                    <h1>{friend_name}</h1>
                </header>
                <div id="channel-content">
                    {chat.map((msg, index) => (
                        <div key={index} className={`message ${msg.senderId === user.user_id ? 'outgoing' : 'incoming'}`}>
                            {msg.content}
                        </div>
                    ))}
                </div>
                <div id="channel-input">
                    <PostForm />
                    <input className="chat-message-bar" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                    <button className="chat-send-button" onClick={sendMessage}>Send</button>
                </div>
            </div>
            <aside id="right-aside">
                <h2>Friends</h2>
                <nav id="friend-list">
                    <ul>
                        {friends.map(friend => (
                            <li key={friend.friend_id}>
                                <Link to={`/messages/${username}/${friend.friend_name}`}>
                                    <button className="chat-channel-button">
                                        {friend.friend_name}
                                    </button>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </div>
    )
}

export default MessagesPage;