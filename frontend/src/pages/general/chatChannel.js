import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../components/authContext';
import { io } from "socket.io-client";
import PostForm from "../../components/postForm";

function ChatChannel({ channelId, channelName, isGroup, locationId }) {
    const [channel, setChannel] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const { user } = useContext(AuthContext)
    const socket = io();
    
    //Update messages in the channel
    useEffect(() => {
        getChannelMessages(channelId);
        socket.on('send_message', (newMessage) => {
            if (newMessage.channel_id === channelId) {
                setChannel((prevMessages) => [...prevMessages, newMessage]);
            }
        });

        return () => {
            socket.off('send_message');
            socket.emit('leave_channel', channelId);
        };
    }, [channelId]);

    //Get messages from the channel
    const getChannelMessages = async (channelId) => {
        try {
            const endpoint = isGroup ? '/api/group_chat_messages' : '/api/profile_chat_messages';
            const response = await axios.get(endpoint);
            setChannel(response.data);
        } catch (error) {
            setErrorMessage("Error getting messages.");
        }
    }

    const sendChannelMessage = async () => {
        //Prevents sending empty messages
        if (!currentMessage.trim()) return;
        socket.emit('send_message', {
            channelId, 
            senderId: user.userId,
            content: currentMessage,
        });
        setCurrentMessage('');
    };

    return (
        <div id="channel">
            <div id="channel-header">
                <p class="large-text">{channelName}</p>
            </div>
            <div id="channel-content">
                {channel.map((msg, index) => (
                    <p key={index} className={`message ${msg.sender_id === user.userId ? 'outgoing' : 'incoming'}`}>{msg.message_content}</p>
                ))}
            </div>
            <div id="channel-input">
                <input className="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && sendChannelMessage()}/>
                <button className="chat-send-button" onClick={sendChannelMessage}>Send</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
}
export default ChatChannel;