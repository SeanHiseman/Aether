import React, { useState } from 'react';
import ReplyForm from './replyForm';

const Comment = ({ comment, depth, addComment }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    
    const toggleReplyForm = () => setShowReplyForm(!showReplyForm);

    return (
        <div className="comment-container" style={{ marginLeft: `${depth * 20}px` }}>
            <div className="comment-profile-container">
                <img className="profile-image" src={`/${comment.Commenter.profile.profile_photo}` || '/media/site_images/blank-profile.png'} alt="Profile" />
                <div className="username">{comment.Commenter.username || 'Anonymous'}</div>
            </div>
            <div className="horizontal-container">
                <div className="comment-element">
                <span className="comment-content">{comment.content}</span>
                <div className="like-dislike-container">
                    <button className="like-button">Like</button>
                    <button className="dislike-button">Dislike</button>
                </div>
                <button className="reply-button" onClick={toggleReplyForm}>Reply</button>
                    {showReplyForm && <ReplyForm parentId={comment.comment_id} addComment={addComment} />}
                </div>
                {comment.replies && comment.replies.map(reply => (
                    <Comment key={reply.comment_id} comment={reply} depth={depth + 1} addComment={addComment} />
                ))}
            </div>
        </div>
      );
};

export default Comment;