import React, { useState } from 'react';
import ReactQuill from 'react-quill';

function ContentWidget({ post }) {
    const [contentReaction, setContentReaction] = useState('');
    const [showComments, setShowComments] = useState(false);

    const addComment = () => {
        console.log("Testing");
    };

    const handleToggleComments = () => {
        //toggleCommentSection(post.post_id);
        setShowComments(!showComments);
    };

    return (
        <div className="content-item">
            <h1>{post.title}</h1>
            <ReactQuill value={post.content} readOnly={true} theme={"bubble"} />
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
                <div className="comment-section" id={`comment-section-${post.post_id}`}>
                    <div className="add-comment">
                        <textarea className="comment-input" id={`new-comment-${post.post_id}`} placeholder="Add a comment"></textarea>
                        <button className="post-comment" onClick={() => addComment(post.post_id, null, document.getElementById(`new-comment-${post.post_id}`).value)}>
                            Post
                        </button>
                    </div>
                    <ul className="comment-list" id={`comment-list-${post.post_id}`}>
                        {/* Comments are populated by JavaScript */}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ContentWidget;
