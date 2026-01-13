import ConfirmModal from '../modals/confirmModal';
import ContentWidget from '../content/contentWidget';
import { FaEdit, FaTrash, FaEllipsisV } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const Message = ({ canRemove, deleteMessage, editMessage, editingMessageId, setEditingMessageId, editContent, setEditContent, isGroup, isOutgoing, isRead, message, maxLength }) => {
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    console.log("Rendering message:", message);
    const isSharedPost = Boolean(message?.shared_post_id);
    console.log("isSharedPost:", isSharedPost);

    //Users can delete their own messages
    if (isOutgoing) {
        canRemove = true;
    };

    const confirmDelete = () => {
        deleteMessage(message.message_id);
        setShowConfirmDelete(false);
    };

    const deleteClick = () => {
        setOptionsOpen(false);
        setShowConfirmDelete(true);
    };

    const editClick = () => {
        setEditingMessageId(message.message_id);
        setEditContent(message.content);
        setOptionsOpen(false);
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
            //Format as date: e.g., 13/12/2025
            return date.toLocaleDateString();
        }
    };

    return (
        <div className={`message-container ${isOutgoing ? 'outgoing' : 'incoming'}${isSharedPost ? ' shared-post' : ''}`}>
            <div className="message-content">
                {!isOutgoing && message.feed && isGroup && (
                    <Link to={`/u/${message.feed.feed_name}`}>
                        <img className="small-feed-photo" src={`${message.feed.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                    </Link>
                )}
                {canRemove && editingMessageId !== message.message_id && (
                    <div className="dropdown" style={{ position: 'relative' }}>
                        <button className="small-icon" type="button" onClick={() => setOptionsOpen(!optionsOpen)} title="Message options">
                            <FaEllipsisV />
                        </button>
                        {optionsOpen && (
                            <div className="dropdown-menu" style={{ position: 'absolute', zIndex: 100, right: 0, top: '100%' }}>
                                <button className="small-icon" type="button" onClick={editClick}>
                                    <FaEdit /><span className="icon-text">Edit</span>
                                </button>
                                <button className="small-icon" type="button" onClick={deleteClick}>
                                    <FaTrash /><span className="icon-text">Delete</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div className={`message ${isSharedPost ? 'shared-post' : (isOutgoing ? 'outgoing' : 'incoming')}`}>
                    {editingMessageId === message.message_id ? (
                        <div>
                            <input
                                type="text"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') editMessage(message.message_id, editContent);
                                    if (e.key === 'Escape') setEditingMessageId(null);
                                }}
                                className="chat-message-bar"
                                autoFocus
                                maxLength={maxLength}
                            />
                            <button onClick={() => editMessage(message.message_id, editContent)}>Save</button>
                            <button onClick={() => setEditingMessageId(null)}>Cancel</button>
                        </div>
                    ) : (
                        <>
                            {message?.content && (
                                <div className="message-text">
                                    {message.content}
                                    {message.edited_at && <span style={{ fontSize: 'small', opacity: 0.7 }}> (edited)</span>}
                                </div>
                            )}
                            {message.sharedPost ? (
                                <div className={`shared-post-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                                    <ContentWidget post={message.sharedPost} readOnly={false} display={false} />
                                </div>
                            ) : message.shared_post_id && (
                                <div className="deleted-post-notice">[Post deleted]</div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <div className={`message-info ${isSharedPost ? '' : (isOutgoing ? 'outgoing' : 'incoming')}`}>
                <p className={`message-date ${isSharedPost ? '' : (isOutgoing ? 'outgoing' : 'incoming')}`}>
                    {formatTimestamp(message.created_at)}
                </p>
                {isOutgoing && !isGroup && (
                    <span className="read-status">
                        {isRead ? "✓✓" : "✓"}
                    </span>
                )}
            </div>
            <ConfirmModal
                isOpen={showConfirmDelete}
                onConfirm={confirmDelete}
                onCancel={() => setShowConfirmDelete(false)}
                message="Are you sure you want to delete this message?"
                title="Delete Message"
            />
        </div>
    );
};

export default Message;