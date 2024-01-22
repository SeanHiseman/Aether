import React, { useState } from 'react';

function ContentItem({ item, contentReaction, toggleCommentSection, addComment }) {
    const [showComments, setShowComments] = useState(false);

    const handleToggleComments = () => {
        toggleCommentSection(item.post_id);
        setShowComments(!showComments);
    };

    return (
        <div className="content-item">
            <h1>{item.title}</h1>

            {item.content_type === "image" && (
                <img className="raw-content" src={`/static/${item.path}`} alt="Content" width="560" />
            )}

            {item.content_type === "video" && (
                <video width="560" height="315" controls>
                    <source className="raw-content" src={`/static/${item.path}`} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            )}

            <div className="content-metadata">
                <div className="uploader-info">
                    <a href={`/profiles/${item.profile_id}`}>
                        <img id="uploader-photo" src={`/static/${item.profile_photo}`} alt="Profile" />
                    </a>
                    <p className="username">{item.username}</p>
                </div>

                <button className="like-button" onClick={() => contentReaction(item.post_id, 'like')}>
                    Likes <span id={`like-count-${item.post_id}`} className="like-count">{item.likes}</span>
                </button>
                <button className="dislike-button" onClick={() => contentReaction(item.post_id, 'dislike')}>
                    Dislikes <span id={`dislike-count-${item.post_id}`} className="dislike-count">{item.dislikes}</span>
                </button>

                <button className="comment-button" data-content-id={item.post_id} onClick={handleToggleComments}>
                    Comments <span className="comment-count" id={`comment-count-${item.post_id}`}>{item.comments}</span>
                </button>
                <span className="view-count">{item.views} Views</span>
            </div>

            {showComments && (
                <div className="comment-section" id={`comment-section-${item.post_id}`}>
                    <div className="add-comment">
                        <textarea className="comment-input" id={`new-comment-${item.post_id}`} placeholder="Add a comment"></textarea>
                        <button className="post-comment" onClick={() => addComment(item.post_id, null, document.getElementById(`new-comment-${item.post_id}`).value)}>
                            Post
                        </button>
                    </div>
                    <ul className="comment-list" id={`comment-list-${item.post_id}`}>
                        {/* Comments are populated by JavaScript */}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ContentItem;
