import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import Comment from '../components/comments/comment';

function ContentWidget({ post }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [showComments, setShowComments] = useState(false);

    useEffect(() => {
        if (showComments) {
            getComments(post.post_id);
        }
    }, [showComments, post.post_id]);

    const addComment = async (postId, parentId, commentContent) => {
        try {
            await axios.post('/api/add_comment', {
                post_id: postId,
                parent_id: parentId || null, 
                content: commentContent,
            });
            getComments(postId); 
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    const contentReaction = async () => {
        console.log("Testing");
    };

    const getComments = async (postId) => {
        try {
            const response = await axios.get(`/api/get_comments/${postId}`);
            setComments(response.data); 
            console.log("Comments:", response.data);
        } catch (error) {
            console.error("Error getting comments:", error);
        }
    };

    const handleToggleComments = () => {
        setShowComments(!showComments);
    };

    //Sorts comments in to replies
    const nestComments = (comments) => {
        const commentMap = {};
        comments.forEach(comment => commentMap[comment.comment_id] = { ...comment, replies: [] });
    
        const nestedComments = [];
        Object.values(commentMap).forEach(comment => {
            if (comment.parent_id === null) {
                nestedComments.push(comment);
            } else if (commentMap[comment.parent_id]) {
                commentMap[comment.parent_id].replies.push(comment);
            }
        });
        console.log("nestedComments:", nestedComments);
        return nestedComments;
    };

    const nestedComments = nestComments(comments);

    return (
        <div className="content-item">
            <h1>{post.title}</h1>
            <div className="react-quill-container">
                <ReactQuill value={post.content} readOnly={true} theme={"bubble"} />
            </div>
            <div className="content-metadata">
                {/*<div className="uploader-info">
                    <a href={`/profile/${post.username}`}>
                        <img class="profile-image" src={`/media/${post.profile_photo}`} alt="Profile" />
                    </a>
                    <p className="username">{post.username}</p>
                </div>*/}
                <button className="like-button" onClick={() => contentReaction(post.post_id, 'like')}>
                    Likes <span id={`like-count-${post.post_id}`} className="like-count">{post.likes}</span>
                </button>
                <button className="dislike-button" onClick={() => contentReaction(post.post_id, 'dislike')}>
                    Dislikes <span id={`dislike-count-${post.post_id}`} className="dislike-count">{post.dislikes}</span>
                </button>

                <button className="comment-button" data-content-id={post.post_id} onClick={handleToggleComments}>
                    Comments <span className="comment-count" id={`comment-count-${post.post_id}`}>{post.comments}</span>
                </button>
                <span className="view-count">{post.views} Views</span>
            </div>
            
            {showComments && (
                <div className="comment-section">
                    <div className="add-comment">
                        <textarea className="comment-input" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Reply..."></textarea>
                        <button className="post-comment" onClick={() => addComment(null, newComment)}>
                            Post
                        </button>
                    </div>
                    {nestedComments.map((comment) => (
                        <Comment key={comment.comment_id} comment={comment} depth={0} addComment={addComment} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

