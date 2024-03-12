import React, { useState } from "react";

const ReplyForm = ({ parentId, addComment }) => {
    const [replyText, setReplyText] = useState('');
  
    const handleSubmit = (e) => {
        e.preventDefault();
        addComment(parentId, replyText);
        setReplyText('');
      };
  
    return (
        <form onSubmit={handleSubmit} className="reply-form">
            <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                className="reply-input"
            />
            <button type="submit" className="post-reply">Post</button>
        </form>
    );
};

export default ReplyForm;