import React, { useEffect, useState } from 'react';
import DirectMessages from './directMessages'; 
import '../css/messages.css';

const MessagesButton = () => {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [friends, setFriends] = useState([]);
    const [activeChat, setActiveChat] = useState({});

    useEffect(() => {
        fetch('/get_friends')
        .then(response => response.json())
        .then(data => setFriends(data))
        .catch(error => console.log("Error fetching friends", error))
    }, []);

    const toggleChat = (friendId, friendName, conversationId) => {
        setActiveChat(prevActiveChat => ({
            ...prevActiveChat, [friendId]: !prevActiveChat[friendId] ? {friendName, conversationId} : undefined
        }));
    };

    return (
        <div className="messages-container">
            <button id="messages-button" onClick={() => setDropdownOpen(!isDropdownOpen)}>Messages</button>
            {isDropdownOpen && (
                <div className="messages-dropdown">
                    {friends.map(friend => (
                        <div key={friend.friend_id}>
                            <div className="friend-chat-box" key={friend.friend_id} 
                                onClick={(e) => toggleChat(friend.friend_id, friend.friend_name, friend.conversation_id)}>
                                <p>{friend.friend_name}</p>
                            </div>
                            {activeChat[friend.friend_id] && (
                                <div className="chat-area">
                                    <DirectMessages 
                                    friendId={friend.friend_id} 
                                    friendName={activeChat[friend.friend_id].friendName}
                                    conversationId={activeChat[friend.friend_id].conversationId} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MessagesButton;
