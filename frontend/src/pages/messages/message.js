import axios from 'axios';
import React from 'react';

const Message = ({ message, isOutgoing, user }) => {
    const isSender = message.message_id === user.user_id ? true : false;
    
    //Deletes the message
    const removeMessage = async (message_id) => {
        try {
            axios.delete('/api/remove_message', { data: message_id });
        } catch (error) {
            console.error("Error removing post:", error); 
        }
    };

    return (
        <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            {message.content}
            {isSender ? (
                <button className="button" onClick={() => removeMessage(message.message_id)}>Delete</button>
            ) : null}
        </div>
    );
};

export default Message;