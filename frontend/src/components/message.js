import axios from 'axios';
import React from 'react';

const Message = ({ canRemove, message, isGroup, isOutgoing, socket, channelId }) => {
    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };

    //Deletes the message
    const removeMessage = async (message_id) => {
        try {
            const route = isGroup ? 'remove_group_message' : 'remove_message';
            axios.delete(`/api/${route}`, { data: { message_id } });
            socket.emit('delete_message', {
                message_id,
                channel_id: channelId,
            });
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
                {message.message_content}
            </div>
        </div>
    );
};

export default Message;