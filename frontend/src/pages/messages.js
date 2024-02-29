import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PostForm from '../components/postForm';

function MessagesPage() {
    const [friends, setFriends] = useState([]);
    const { friend_name, username } = useParams();
    const [message, setMessage] = useState('');
    useEffect(() => {
        fetch('/api/get_friends')
        .then(response => response.json())
        .then(data => setFriends(data))
        .catch(error => console.log("Error fetching friends", error))
    }, []);

    document.title = "Messages";
    return (
        <div className="messages-container">
            <div className="content-feed">
                <header id="messages-header">
                    <h1>{friend_name}</h1>
                </header>
                <div id="channel-content">
                    <p>Content goes here</p>
                </div>
                <div id="channel-input">
                    <PostForm />
                    <input className="chat-message-bar" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                    <button className="chat-send-button">Send</button>
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