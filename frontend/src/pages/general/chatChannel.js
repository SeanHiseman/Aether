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
    const socket = io(`http://localhost:7000`);

    //Update messages in the channel
    useEffect(() => {
        getChannelMessages(channelId);
        socket.on('new_message', (newMessage) => {
            if (newMessage.channel_id === channelId) {
                setChannel((prevMessages) => [...prevMessages, newMessage]);
            }
        });

        return () => {
            socket.off('new_message');
            socket.emit('leave_channel', channelId);
        };
    }, [channelId]);

    //Get messages from the channel
    const getChannelMessages = async (channelId) => {
        try {
            const endpoint = isGroup ? `/api/group_channel_messages/${channelId}` : `/api/profile_channel_messages/${channelId}`;
            const response = await axios.get(endpoint);
            setChannel(response.data);
        } catch (error) {
            setErrorMessage("Error getting messages.");
        }
    }

    const sendChannelMessage = () => {
        //Prevents sending empty messages
        if (!currentMessage.trim()) return;
        const newMessage = {
            channelId, 
            groupId: locationId,
            content: currentMessage,
            senderId: user.userId, 
        }
        socket.emit('send_group_message', newMessage);
        //setChannel(prevChannel => [...prevChannel, newMessage]);
        setCurrentMessage('');
    };

    return (
        <div id="channel">
            <div id="channel-content">
                {channel.map((msg, index) => (
                    <p key={index} class={`message ${msg.sender_id === user.userId ? 'outgoing' : 'incoming'}`}>{msg.message_content}</p>
                ))}
            </div>
            <div id="channel-input">
                <input class="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && sendChannelMessage()}/>
                <button class="chat-send-button" onClick={sendChannelMessage}>Send</button>
                {errorMessage && <div class="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
}
export default ChatChannel;