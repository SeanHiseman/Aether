import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../authContext';
import ReplyForm from './replyForm';

const Reply = ({ addReply, reply, depth, isGroup, onReplyAdded }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [downvotes, setDownvotes] = useState(reply.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [upvotes, setUpvotes] = useState(reply.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const { user } = useContext(AuthContext);
    const isReplier = reply.replier_id === user.user_id ? true : false;
    const Replier = isGroup ? 'GroupReplier' : 'ProfileReplier'; //Associations used by database
    const toggleReplyForm = () => setShowReplyForm(!showReplyForm);

    //Sets the upvote/downvote limits upon rendering
    useEffect(() => {
        const checkVoteLimit = async () => {
            try {
                const response = await axios.post('/api/reply_vote', { reply_id: reply.reply_id, isGroup, vote_type: 'check_vote' });

                if (response.data.message === 'upvote limit') {
                    setUpvoteLimit(true);
                } else if (response.data.message === 'downvote limit') {
                    setDownvoteLimit(true);
                }
            } catch (error) {
                console.error('Error checking vote limit:', error);
            }
        };

        checkVoteLimit();
    }, [reply.reply_id, isGroup]);

    //Updates up/downvotes
    const handleVote = (voteType) => {
        try {
            if ((voteType === 'upvote' && upvoteLimit) || (voteType === 'downvote' && downvoteLimit)) {
                return;
            }
            //Reset before request
            setDownvoteLimit(false);
            setUpvoteLimit(false);
            axios.post('/api/reply_vote', { reply_id: reply.reply_id, isGroup, vote_type: voteType })
                .then((response) => {
                    if (response.data.success) {
                        if (voteType === 'upvote') {
                            setUpvotes(upvotes + 1);
                        } else if (voteType === 'downvote')  {
                            setDownvotes(downvotes + 1);
                        }
                    } else {
                        if (voteType === 'upvote') {
                            setUpvoteLimit(true);
                        } else if (voteType === 'downvote') {
                            setDownvoteLimit(true);
                        }
                    }
                }).catch(error => {
                    console.error('Error:', error);
                });
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    //Deletes the reply
    const removeReply = async (isGroup, reply_id) => {
        try {
            const replyData = { isGroup, reply_id }
            axios.delete('/api/remove_reply', { data: replyData });
        } catch (error) {
            console.error("Error removing reply:", error); 
        }
    };

    const downvoteClass = downvoteLimit ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit ? 'vote-disabled' : 'vote-enabled';
    
    return (
        <div className="reply-container" style={{ marginLeft: `${depth * 20}px` }}>
            <Link className="reply-profile-container" to={`/profile/${reply[Replier].username}`}>
                <img className="uploader-profile-image" src={`/${reply[Replier].profile.profile_photo}` || '/media/site_images/blank-profile.png'} alt="Profile" />
                <p className="username">{reply[Replier].username || 'Anonymous'}</p>
            </Link>
            <div className="horizontal-container">
                <div className="reply-element">
                <span className="reply-content">{reply.content}</span>
                <div className="reply-vote-container">
                    <button className={`vote-arrow-container ${upvoteClass}`} onClick={() => handleVote('upvote')}>
                        <img className={`vote-arrow ${upvoteClass}`} src="/media/site_images/up.png" alt="upvote" />
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={`vote-arrow-container ${downvoteClass}`} onClick={() => handleVote('downvote')}>
                        <img className={`vote-arrow ${downvoteClass}`} src="/media/site_images/down.png" alt="downvote" />
                    </button>
                    <button className="button" onClick={toggleReplyForm}>Reply</button>
                        {showReplyForm && <ReplyForm isGroup={isGroup} onReplyAdded={onReplyAdded} parentId={reply.reply_id} postId={reply.post_id} />}
                </div>
                {isReplier ? (
                    <button className="button" onClick={() => removeReply(isGroup, reply.reply_id)}>Delete</button>
                ) : null}
            </div>
                {reply.replies && reply.replies.map(reply => (
                    <Reply key={reply.reply_id} reply={reply} depth={depth + 1} addReply={addReply} />
                ))}
            </div>
        </div>
      );
};

export default Reply;