import { Link } from 'react-router-dom';
//import ContentDisplay from './content/contentDisplay';

const Message = ({ canRemove, deleteMessage, isGroup, isOutgoing, isRead, message }) => {
    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };

    const isToday = (timestamp) => {
        const messageDate = new Date(timestamp);
        const today = new Date();
        return (
            messageDate.getDate() === today.getDate() &&
            messageDate.getMonth() === today.getMonth() && 
            messageDate.getFullYear() === today.getFullYear()
        );
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        if (isToday(timestamp)) {
            //Format as hour and minute e.g. 22:36
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            //Format as date: e.g., 13/10/2024
            return date.toLocaleDateString();
        }
    };

    return (
        <div className={`message-container ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            <div className="message-content">
                {!isOutgoing && message.feed && isGroup && (
                    <Link to={`/u/${message.feed.feed_name}`}>
                        <img className="small-feed-photo" src={`/${message.feed.feed_photo}`} alt="Feed" />
                    </Link>
                )}
                {canRemove ? (
                    <button className="button" onClick={() => deleteMessage(message.message_id)} title="Delete message">-</button>
                ) : null}
                <div className={`message ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                    {message.content}
                    {/*<ContentDisplay content={message.content}/>*/}
                </div>
            </div>
            <div className={`message-info ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                <p className={`message-date ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                    {formatTimestamp(message.created_at)}
                </p>
                {isOutgoing && !isGroup && (
                    <span className="read-status">
                        {isRead ? "✓✓" : "✓"}
                    </span>
                )}
            </div>
        </div>
    );
};

export default Message;