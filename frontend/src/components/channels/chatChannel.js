import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../authContext';
import { io } from "socket.io-client";
import { v4 } from 'uuid';
import Message from '../message';

const ChatChannel = ({ canRemove, channelId, isGroup, locationId }) => {
    const [channel, setChannel] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const { user } = useContext(AuthContext)
    const socket = io(`http://localhost:7000`);

    //Update messages in the channel
    useEffect(() => {
        socket.emit('join_channel', channelId);
        getChannelMessages(channelId);
        //Listens for new messages
        socket.on('new_message', (newMessage) => {
            if (newMessage.channel_id === channelId) {
                setChannel((prevMessages) => [...prevMessages, newMessage]);
            }
        });
        return () => {
            socket.off('new_message');
            socket.emit('leave_channel', channelId);
        };
    }, [channelId, socket]);

    //Deletes the message
    const deleteMessage = (messageId) => {
        if (messageId) {
            socket.emit('delete_message', {
                message_id: messageId,
                channel_id: channelId,
            });
            setChannel(prevChat => prevChat.filter(msg => msg.message_id !== messageId));
        } else {
            setErrorMessage("Error deleting message");
        }
    };

    //Get messages from the channel
    const getChannelMessages = async (channelId) => {
        try {
            const response = await axios.get(`/api/feed_channel_messages/${channelId}`);
            setChannel(response.data);
        } catch (error) {
            setErrorMessage("Error getting messages");
        }
    };

    const sendChannelMessage = () => {
        try {
            //Prevents sending empty messages
            if (!currentMessage.trim()) return;
            const newMessage = {
                message_id: v4(),
                message_content: currentMessage,
                channelId, 
                groupId: locationId,
                sender_id: user.userId, 
                timestamp: new Date()
            }
            socket.emit('send_feed_message', newMessage);
            setChannel(prevChat => [...prevChat, newMessage]);
            setCurrentMessage('');
        } catch (error) {
            setErrorMessage("Error sending message");
        }
    };

    return (
        <div className="channel">
            <div className="channel-content messages">
                {channel.slice().reverse().map((msg, index) => (
                    <Message canRemove={canRemove} deleteMessage={deleteMessage} key={index} message={msg} isGroup={isGroup} isOutgoing={msg.sender_id === user.userId} socket={socket} channelId={channelId}/>
                ))}
            </div>
            <div className="messages-channel-footer">
                <input className="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && sendChannelMessage()}/>
                <button className="chat-send-button" onClick={sendChannelMessage}>Send</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
}
export default ChatChannel;