import React from 'react';

const Message = ({ canRemove, deleteMessage, message, isOutgoing }) => {
    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };

    return (
        <div className={`message-container ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            <div className="message-content">
                {!isOutgoing && (
                    <img className="profile-image2" src={`/${message.user.profile.profile_photo}`} alt="Profile" />
                )}
                {canRemove ? (
                    <button className="light-button" onClick={() => deleteMessage(message.message_id)}>-</button>
                ) : null}
                <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                    {message.message_content}
                </div>
            </div>
            <p className={`message-date ${isOutgoing ? 'outgoing' : 'incoming'}`}>{new Date(message.timestamp).toLocaleDateString()}</p>
        </div>
    );
};

export default Message;