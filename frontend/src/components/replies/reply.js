import axios from 'axios';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ReplyForm from './replyForm';

const Reply = ({ addComment, comment, depth, isGroup, onReplyAdded }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [downvotes, setDownvotes] = useState(comment.dislikes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [upvotes, setUpvotes] = useState(comment.likes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const Replier = isGroup ? 'GroupCommenter' : 'ProfileCommenter'; //Associations used by database
    const toggleReplyForm = () => setShowReplyForm(!showReplyForm);

    //Updates up/downvotes
    const handleVote = (voteType) => {
        //Reset before request
        setDownvoteLimit(false);
        setUpvoteLimit(false);

        //Check if at voting limit
        if (voteType === 'upvote' && upvotes === 10) {
            setUpvoteLimit(true);
            return;
        } else if (voteType === 'downvote' && downvotes === 10) {
            setDownvoteLimit(true);
            return;
        }

        //Update if limit hasn't been reached
        setUpvotes(voteType === 'upvote' ? upvotes + 1 : upvotes);
        setDownvotes(voteType === 'downvote' ? downvotes + 1 : downvotes);

        const vote = {
            comment_id: comment.comment_id,
            isGroup,
            vote_type: voteType
        };
        
        axios.post('/api/reply_vote', vote)
            .catch(error => {
                console.error('Error:', error);
                if (voteType === 'upvote') {
                    setUpvotes(upvotes); 
                } else if (voteType === 'downvote') {
                    setDownvotes(downvotes); 
                }
            });
    };

    const downvoteStyle = downvoteLimit ? 'downvote-disabled' : 'downvote-enabled';
    const upvoteStyle = upvoteLimit ? 'upvote-disabled' : 'upvote-enabled';
    
    return (
        <div className="comment-container" style={{ marginLeft: `${depth * 20}px` }}>
            <Link className="reply-profile-container" to={`/profile/${comment[Replier].username}`}>
                <img className="uploader-profile-image" src={`/${comment[Replier].profile.profile_photo}` || '/media/site_images/blank-profile.png'} alt="Profile" />
                <p className="username">{comment[Replier].username || 'Anonymous'}</p>
            </Link>
            <div className="horizontal-container">
                <div className="comment-element">
                <span className="comment-content">{comment.content}</span>
                <div className="reply-vote-container">
                    <button className={upvoteStyle} onClick={() => handleVote('upvote')}>
                        <img className="vote-arrow" src="/media/site_images/up.png"/>
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={downvoteStyle} onClick={() => handleVote('downvote')}>
                        <img className="vote-arrow" src="/media/site_images/down.png"/>
                    </button>
                    <button className="button" onClick={toggleReplyForm}>Reply</button>
                        {showReplyForm && <ReplyForm isGroup={isGroup} onReplyAdded={onReplyAdded} parentId={comment.comment_id} postId={comment.post_id} />}
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