import axios from 'axios';
import React, { useState } from 'react';
import ReplyForm from './replyForm';

const Reply = ({ addComment, comment, depth, onReplyAdded }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [downvotes, setDownvotes] = useState(comment.dislikes);
    const [upvotes, setUpvotes] = useState(comment.likes);
    const toggleReplyForm = () => setShowReplyForm(!showReplyForm);

    //Updates up/downvotes
    const handleVote = (voteType) => {
        if (voteType === 'upvote') {
            setUpvotes(upvotes + 1);
        } else if (voteType === 'downvote') {
            setDownvotes(downvotes + 1);
        }

        const vote = {
            comment_id: comment.comment_id,
            vote_type: voteType
        };
        
        axios.post('/api/reply_vote', vote)
            .then(response => {
                console.log("Success:", response.data);
            })
            .catch(error => {
                console.error('Error:', error);
                if (voteType === 'upvote') {
                    setUpvotes(upvotes); 
                } else if (voteType === 'downvote') {
                    setDownvotes(downvotes); 
                }
            });
    };

    return (
        <div className="comment-container" style={{ marginLeft: `${depth * 20}px` }}>
            <div className="comment-profile-container">
                <img className="profile-image" src={`/${comment.Commenter.profile.profile_photo}` || '/media/site_images/blank-profile.png'} alt="Profile" />
                <div className="username">{comment.Commenter.username || 'Anonymous'}</div>
            </div>
            <div className="horizontal-container">
                <div className="comment-element">
                <span className="comment-content">{comment.content}</span>
                <div className="reply-vote-container">
                    <button className="vote-button" onClick={() => handleVote('upvote')}>
                        <img className="vote-arrow" src="/media/site_images/up.png"/>
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className="vote-button" onClick={() => handleVote('downvote')}>
                        <img className="vote-arrow" src="/media/site_images/down.png"/>
                    </button>
                    <button className="button" onClick={toggleReplyForm}>Reply</button>
                        {showReplyForm && <ReplyForm postId={comment.post_id} parentId={comment.comment_id} onReplyAdded={onReplyAdded} />}
                </div>
            </div>
                {comment.replies && comment.replies.map(reply => (
                    <Reply key={reply.comment_id} comment={reply} depth={depth + 1} addComment={addComment} />
                ))}
            </div>
        </div>
      );
};

export default Reply;