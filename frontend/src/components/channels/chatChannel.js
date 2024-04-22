import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../authContext';
import { io } from "socket.io-client";
import Message from '../message';

function ChatChannel({ canRemove, channelId, isGroup, locationId }) {
    const [channel, setChannel] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const { user } = useContext(AuthContext)
    const socket = io(`http://localhost:7000`);

    //Update messages in the channel
    useEffect(() => {
        getChannelMessages(channelId);
        //Listens for new messages
        socket.on('new_message', (newMessage) => {
            if (newMessage.channel_id === channelId) {
                setChannel((prevMessages) => [...prevMessages, newMessage]);
            }
        });
        //Listens for deletions
        socket.on('delete_message', (deletedMessage) => {
            if (deletedMessage.channel_id === channelId) {
                setChannel((prev) => prev.filter((msg) => msg.message_id !== deletedMessage.message_id));
            }
        });
        return () => {
            socket.off('new_message');
            socket.off('delete_message');
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
            message_content: currentMessage,
            senderId: user.userId, 
        }
        socket.emit('send_group_message', newMessage);
        setCurrentMessage('');
    };

    return (
        <div id="channel">
            <div id="channel-content">
                {channel.map((msg, index) => (
                    <Message canRemove={canRemove} key={index} message={msg} isGroup={isGroup} isOutgoing={msg.sender_id === user.userId} socket={socket} channelId={channelId}/>
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