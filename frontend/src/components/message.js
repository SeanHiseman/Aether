import axios from 'axios';
import React from 'react';

const Message = ({ canRemove, message, isOutgoing, user }) => {
    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };
    
    //Deletes the message
    const removeMessage = async (message_id) => {
        try {
            axios.delete('/api/remove_message', { data: message_id });
        } catch (error) {
            console.error("Error removing post:", error); 
        }
    };

    return (
        <div className={`message-container ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            {canRemove ? (
                <button className="light-button" onClick={() => removeMessage(message.message_id)}>Delete</button>
            ) : null}
            <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                {message.content}
            </div>
        </div>
    );
};

export default Message;