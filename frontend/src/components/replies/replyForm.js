import axios from "axios";
import React, { useState } from "react";

const ReplyForm = ({ isGroup, onReplyAdded, postId, parentId }) => {
    const [replyContent, setReplyContent] = useState('');
    
    const addReply = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/add_reply', {
                content: replyContent,
                parent_id: parentId || null, 
                isGroup: isGroup,
                post_id: postId,
            });
            onReplyAdded(response.data);
            console.log("response.data", response.data);
            setReplyContent('');
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    return (
        <form onSubmit={addReply} className="reply-form">
            <textarea className="reply-input" value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="Reply..."/>
            <button type="submit" className="button">Post</button>
        </form>
    );
};

export default ReplyForm;