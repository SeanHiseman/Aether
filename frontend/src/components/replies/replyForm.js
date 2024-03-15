import axios from "axios";
import React, { useState } from "react";

const ReplyForm = ({ postId, parentId, onReplyAdded }) => {
    const [replyContent, setReplyContent] = useState('');
    
    const addReply = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/api/add_reply', {
                post_id: postId,
                parent_id: parentId || null, 
                content: replyContent,
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