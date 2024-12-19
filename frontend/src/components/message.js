import React from 'react';
import { Link } from 'react-router-dom';
import ContentDisplay from './content/contentDisplay';

const Message = ({ canRemove, deleteMessage, message, isOutgoing }) => {
    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };

    return (
        <div className={`message-container ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            <div className="message-content">
                {!isOutgoing && message.feed && (
                    <Link to={`/u/${message.feed.feed_name}`}>
                        <img className="small-feed-photo" src={`/${message.feed.feed_photo}`} alt="Feed" />
                    </Link>
                )}
                {canRemove ? (
                    <button className="button" onClick={() => deleteMessage(message.message_id)}>-</button>
                ) : null}
                <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                    <ContentDisplay content={message.content}/>
                </div>
            </div>
            <p className={`message-date ${isOutgoing ? 'outgoing' : 'incoming'}`}>{new Date(message.timestamp).toLocaleDateString()}</p>
        </div>
    );
};

export default Message;