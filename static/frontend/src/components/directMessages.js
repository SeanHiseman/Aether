import React, {useState, useEffect, useRef, useContext } from 'react';
import { io } from "socket.io-client";
import { useUser } from '../components/userContext';
import '../css/messages.css';

const socket = io("http://localhost:8000/chat");

const DirectMessages = ({ friendId , friendName, conversationId }) => {
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);
    const { user } = useUser();
    const chatBoxRef = useRef(null);

    useEffect(() => {
        //Listen for incoming messages
        socket.on('receive_message', (message) => {
            setChat(prevChat => [...prevChat, message]);
        });
        
        socket.on('error_message', function(data) {
            alert(data.error);
        });

        socket.on('message_confirmed', (message) => {
            setChat(prevChat => [...prevChat, message]);
        });
    
        //Get existing messages
        if (conversationId){
            fetch(`/get_chat_messages/${conversationId}`)
            .then(response => response.json())
            .then(data => {
                if (data.error){
                    console.error("Conversation not found");
                }
                else{
                    setChat(data);
                }
            })
            .catch(error => console.log("Error fetching chat messages", error));
        }
        return () => {
            socket.off('receive message');
            socket.off('error_message');
            socket.off('message_confirmed');
        };
    }, [conversationId]);

    const sendMessage = () => {
        //Emits new message to server
        const newMessage = {
            content: message,
            senderId: user.user_id,
            conversationId: conversationId,
        };
        socket.emit('send_message', newMessage);
        setMessage('');
    };

    if (!user) {
        return <div>Loading...</div>
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                {friendName} 
            </div>
            <div className="chat-messages" ref={chatBoxRef}> 
                {chat.map((msg, index) => (
                        <div key={index} className={`message ${msg.senderId === user.user_id ? 'outgoing' : 'incoming'}`}>
                            {msg.content}
                        </div>
                ))}
            </div>
            <div className="chat-input">
                <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                <button id="message-send-button" onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
};
export default DirectMessages;