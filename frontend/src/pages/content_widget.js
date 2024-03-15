import axios from 'axios';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import Reply from '../components/replies/reply';
import ReplyForm from '../components/replies/replyForm';

function ContentWidget({ isGroup, post }) {
    const [comments, setComments] = useState([]);
    const [showComments, setShowComments] = useState(false);
    const Poster = isGroup ? 'GroupPoster' : 'ProfilePoster'; //Associations used by database

    useEffect(() => {
        if (showComments) {
            getComments(post.post_id);
        }
    }, [showComments, post.post_id]);

    const contentReaction = async (postId, voteType) => {
        console.log("Testing", postId, voteType);
    };

    const getComments = async (postId) => {
        try {
            const response = await axios.get(`/api/get_comments/${postId}?isGroup=${isGroup}`);
            setComments(response.data); 
        } catch (error) {
            console.error("Error getting comments:", error);
        }
    };

    //Updates comments after new one added
    const handleReplyAdded = (newComment) => {
        setComments(currentComments => [...currentComments, newComment]);
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
                <div className="profile-info">
                    <Link className="profile-link" to={`/profile/${post[Poster].username}`}>
                        <img class="uploader-profile-image" src={`/${post[Poster].profile.profile_photo}`} alt="Profile" />
                        <p className="username">{post[Poster].username}</p>
                    </Link>
                </div>
                <button className="like-button" onClick={() => contentReaction(post.post_id, 'upvote')}>
                    Likes <span className="like-count">{post.likes}</span>
                </button>
                <button className="dislike-button" onClick={() => contentReaction(post.post_id, 'downvote')}>
                    Dislikes <span className="dislike-count">{post.dislikes}</span>
                </button>

                <button className="button" data-content-id={post.post_id} onClick={handleToggleComments}>
                    Replies <span className="comment-count" id={`comment-count-${post.post_id}`}>{post.comments}</span>
                </button>
                <span className="view-count">{post.views} Views</span>
            </div>
            
            {showComments && (
                <div className="comment-section">
                    <div className="add-comment">
                        <ReplyForm isGroup={isGroup} onReplyAdded={handleReplyAdded} parentId={null} postId={post.post_id} />
                    </div>
                    {nestedComments.map((comment) => (
                        <Reply key={comment.comment_id} comment={comment} depth={0} isGroup={isGroup} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

