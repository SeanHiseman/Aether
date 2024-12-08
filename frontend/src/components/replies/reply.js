import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../authContext';
import ReactQuill from 'react-quill';
import AskButton from '../askButton';
import ContentForm from '../content/contentForm';

const Reply = ({ addReply, reply, depth, isGroup, onReplyAdded, onReplyRemoved, postId }) => {
    const [downvotes, setDownvotes] = useState(reply.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);    
    const [note, setNote] = useState(reply.note ? reply.note.note_content : '');
    const [showNote, setShowNote] = useState(reply.note && reply.note.is_misinfo);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [upvotes, setUpvotes] = useState(reply.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const { user } = useContext(AuthContext);
    const isReplier = reply.replier_id === user.userId ? true : false;
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

    const handleReplySubmit = async (formData) => {
        try {
            formData.append('parent_id', reply.reply_id);
            formData.append('postId', postId);
            const response = await axios.post('/api/add_reply', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success === true) {
                onReplyAdded(response.data.reply);
                setShowReplyForm(false);
            }
        } catch (error) {
            console.error("Error adding reply:", error);
        }
    };

    const handleVote = async (voteType) => {
        try {
            if ((voteType === 'upvote' && upvoteLimit) || (voteType === 'downvote' && downvoteLimit)) {
                return;
            }
            //Reset before request
            setDownvoteLimit(false);
            setUpvoteLimit(false);
            const response = await axios.post('/api/reply_vote', { reply_id: reply.reply_id, isGroup, vote_type: voteType })
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
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const removeReply = async (replyId) => {
        try {
            const replyData = { isGroup, replyId, postId }
            const response = await axios.delete('/api/remove_reply', { data: replyData });
            if (response.data.success) {
                onReplyRemoved(replyId);
            }
        } catch (error) {
            console.error("Error removing reply:", error); 
        }
    };
 
    const downvoteClass = downvoteLimit || isReplier ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit || isReplier ? 'vote-disabled' : 'vote-enabled';
    
    return (
        <div className="reply-container" style={{ marginLeft: `${depth * 20}px` }}>
            <Link className="reply-feed-container" to={`/u/${reply[Replier].username}`}>
                <img className="uploader-feed-image" src={`/${reply[Replier].profile.profile_photo}` || '/media/site_images/blank-profile.png'} alt="Feed" />
                <p className="username">{reply[Replier].username || 'Anonymous'}</p>
            </Link>
            <div className="horizontal-container">
                <div className="reply-element">
                    <ReactQuill value={reply.content} readOnly={true} theme={"bubble"} />
                    {showNote && (
                        <div className="ask-note">
                            <p className="ask-note-text">{note}</p>
                        </div>
                    )}
                    <div className="message-buttons">
                        <button className={`vote-arrow-container ${upvoteClass}`} onClick={() => handleVote('upvote')} disabled={isReplier}>
                            <img className={`vote-arrow ${upvoteClass}`} src="/media/site_images/up.png" alt="upvote" />
                        </button>
                        <span className="total-votes">{upvotes - downvotes}</span>
                        <button className={`vote-arrow-container ${downvoteClass}`} onClick={() => handleVote('downvote')} disabled={isReplier}>
                            <img className={`vote-arrow ${downvoteClass}`} src="/media/site_images/down.png" alt="downvote" />
                        </button>
                        <button className="button large" onClick={toggleReplyForm}>Reply</button>
                        {isReplier && (<button className="button large" onClick={() => removeReply(reply.reply_id)}>Delete</button>)}
                        {!reply.note?.is_misinfo && (<AskButton isGroup={isGroup} isReply={true} content={reply} showNote={showNote} setShowNote={setShowNote} note={note} setNote={setNote} />)}
                    </div>
                    {showReplyForm && <ContentForm isReply={true} onSubmit={handleReplySubmit} />}
                </div>
                {reply.replies && reply.replies.map(reply => (
                    <Reply key={reply.reply_id} addReply={addReply} reply={reply} depth={depth + 1} isGroup={isGroup} onReplyAdded={onReplyAdded} onReplyRemoved={onReplyRemoved} postId={postId} />
                ))}
            </div>
        </div>
      );
};

export default Reply;