import React from 'react';

const Message = ({ canRemove, deleteMessage, message, isOutgoing }) => {
    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };
    console.log("message:", message);
    return (
        <div className={`message-container ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            {!isOutgoing && (
                <img className="profile-image" src={`/${message.user.profile.profile_photo}`} alt="Profile" />
            )}
            {canRemove ? (
                <button className="light-button" onClick={() => deleteMessage(message.message_id)}>-</button>
            ) : null}
            <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                {message.message_content}
            </div>
        </div>
    );
};

export default Message;