import axios from 'axios';
import { Link } from 'react-router-dom';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { AuthContext } from './authContext';
import AskButton from './askButton';
import ContentForm from './contentForm';
import Reply from './replies/reply';

const ContentWidget = ({ canRemove: canRemoveProp, feed, isGroup, onPostRemoved, post }) => {
    const [canRemove, setCanRemove] = useState(canRemoveProp);
    const [downvotes, setDownvotes] = useState(post.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [hasViewed, setHasViewed] = useState(false);
    const [note, setNote] = useState(post.note ? post.note.note_content : '');
    const [replies, setReplies] = useState([]);
    const [showNote, setShowNote] = useState(post.note && post.note.is_misinfo);
    const [showReplies, setShowReplies] = useState(false);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [upvotes, setUpvotes] = useState(post.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const isViewingOwnPost = post.poster_id === feed.feedId; 
    const { user } = useContext(AuthContext);

    const getReplies = useCallback(async (postId) => {
        try {
            const response = await axios.get(`/api/get_replies/${postId}?isGroup=${isGroup}`);
            setReplies(response.data); 
        } catch (error) {
            console.error("Error getting replies:", error);
        }
    }, [isGroup]);

    //Adds a view to the post
    const incrementViews = useCallback(async (postId) => {
        try {
            if (hasViewed === false) {
                await axios.post('/api/increment_views', { postId });
                setHasViewed(true);
            }
        } catch (error) {
            console.error("Error incrementing views:", error);
        }
    }, [hasViewed]);
    
    //Allows removal of own posts
    useEffect(() => {
        if (isViewingOwnPost) {
            setCanRemove(true);
        }
    }, [isViewingOwnPost, post.poster_id, user.userId]);

    //Opens replies
    useEffect(() => {
        if (showReplies) {
            getReplies(post.post_id);
        }
    }, [getReplies, post.post_id, showReplies]);
    
    //Adds a view if replies are opened
    useEffect(() => {
        if (showReplies && !hasViewed) {
            incrementViews(post.post_id);
            setHasViewed(true);
        }
    }, [hasViewed, incrementViews, post.post_id, showReplies]);
 
    //Sets the upvote/downvote limits upon rendering
    useEffect(() => {
        const checkVoteLimit = async () => {
            try {
                const response = await axios.post('/api/content_vote', { contentId: post.post_id, feedId: feed.feedId, voteType: 'check_vote' });
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
    }, [post.post_id, isGroup]);

    //Allows React Quill to display videos
    const BlockEmbed = Quill.import('blots/block/embed');
    class VideoBlot extends BlockEmbed {
        static create(value) {
            let node = super.create();
            node.setAttribute('src', value.url);
            node.setAttribute('controls', true);
            return node;
        }

        static value(node) {
            return { url: node.getAttribute('src') };
        }
    }
    VideoBlot.blotName = 'video';
    VideoBlot.tagName = 'video';
    Quill.register(VideoBlot);

    const replyAdded = (newReply) => {
        setReplies(currentReplies => [...currentReplies, newReply]);
    };

    const replyRemoved = (replyId) => {
        setReplies((prevReplies) => prevReplies.filter((reply) => reply.reply_id !== replyId));
    };

    const handleReplySubmit = async (formData) => {
        try {
            formData.append('postId', post.post_id);
            formData.append('isGroup', isGroup);
            //Send the form data to the server
            const response = await axios.post('/api/add_reply', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success === true) {
                //Add the new reply to the local state
                setReplies(currentReplies => [...currentReplies, response.data.reply]);
            } else {
                console.error("Failed to add reply:", response.data.message);
            }
        } catch (error) {
            console.error("Error adding reply:", error);
        }
    };

    //Sorts replies by parent and by net upvotes
    const nestReplies = (replies) => {
        const replyMap = {};
        replies.forEach(reply => replyMap[reply.reply_id] = { ...reply, replies: [] });
        const nestedReplies = [];
        Object.values(replyMap).forEach(reply => {
            if (reply.parent_id === null) {
                nestedReplies.push(reply);
            } else if (replyMap[reply.parent_id]) {
                replyMap[reply.parent_id].replies.push(reply);
            }
        });
        const sortByNetUpvotes = (a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
        const sortedReplies = nestedReplies.map(reply => {
            const sortedChildReplies = [...reply.replies].sort(sortByNetUpvotes);
            return { ...reply, replies: sortedChildReplies };
        })
        return sortedReplies.sort(sortByNetUpvotes);
    };

    //Deletes the post
    const removePost = async () => {
        try {
            const response = await axios.delete('/api/remove_post', { postId: post.post_id } );
            if (response.data.success) {
                onPostRemoved(post.post_id);
            }
        } catch (error) {
            console.error("Error removing post:", error); 
        }
    };

    //Updates up/downvotes
    const postVote = async (postId, voteType) => {
        try {
            if ((voteType === 'upvote' && upvoteLimit) || (voteType === 'downvote' && downvoteLimit)) {
                return;
            }
            setDownvoteLimit(false);
            setUpvoteLimit(false);
            try {
                const response = await axios.post('/api/content_vote', { contentId: postId, feedId: feed.feed_id, vote_type: voteType });
                if (response.data.success) {
                    if (voteType === 'upvote') {
                        setUpvotes(upvotes + 1);
                    } else if (voteType === 'downvote') {
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
                console.error('Error:', error);
            }
    
            if (!hasViewed) {
                incrementViews(postId);
                setHasViewed(true);
            }
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const toggleReplies = () => { setShowReplies(!showReplies) };
    const toggleReplyForm = () => { setShowReplyForm(!showReplyForm) };
    const nestedReplies = nestReplies(replies);
    const downvoteClass = downvoteLimit || isViewingOwnPost ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit || isViewingOwnPost ? 'vote-disabled' : 'vote-enabled';

    return (
        <Link to={`/${post.parentFeed}/${post.parentChannel}/${post.post_id}`}>
            <div className="content-item">
                <div className="title-container">
                    <p className="text36">{post.title}</p>
                    {post.displayGroupName && (
                        <Link className="profile-link" to={`/g/${post.feed.feed_name}`}>
                            <p className="text24">{post.feed.feed_name}</p>
                            <img className="uploader-profile-image" src={`/${post.feed.feed_photo}`} alt="Profile" />
                        </Link>
                    )}
                </div>
                <div className="react-quill-container">
                    <ReactQuill value={post.content} readOnly={true} theme={"bubble"} />
                </div>
                {showNote && (
                    <div className="ask-note">
                        <p className="ask-note-text">{note}</p>
                    </div>
                )}
                <div className="content-metadata">
                    <div className="profile-info">
                        <Link className="profile-link" to={`/u/${post.feed.feed_name}`} onClick={() => incrementViews(post.post_id)}>
                            <img className="uploader-profile-image" src={`/${post.feed.feed_photo}`} alt="Feed" />
                            <p className="username">{post.feed.feed_name} </p>
                        </Link>
                    </div>
                    <div className="vote-container">
                        <button className={`vote-arrow-container ${upvoteClass}`} onClick={() => postVote(post.post_id, 'upvote')} disabled={isViewingOwnPost}>
                            <img className={`vote-arrow ${upvoteClass}`} src="/media/site_images/up.png" alt="upvote" />
                        </button>
                        <span className="total-votes">{upvotes - downvotes}</span>
                        <button className={`vote-arrow-container ${downvoteClass}`} onClick={() => postVote(post.post_id, 'downvote')} disabled={isViewingOwnPost}>
                            <img className={`vote-arrow ${downvoteClass}`} src="/media/site_images/down.png" alt="downvote" />
                        </button>
                    </div>
                    <button className="button large" data-content-id={post.post_id} onClick={toggleReplies}>
                        Replies <span className="reply-count" id={`reply-count-${post.post_id}`}>{post.replies}</span>
                    </button>
                    <span className="view-count">{post.views} Views</span>
                    <p>{new Date(post.timestamp).toLocaleDateString()}</p>
                    {canRemove ? (
                        <button className="button large" onClick={() => removePost(isGroup, post.post_id)}>Delete</button>
                    ) : null}
                    {!post.note?.is_misinfo && (
                        <AskButton isGroup={isGroup} isReply={false} content={post} showNote={showNote} setShowNote={setShowNote} note={note} setNote={setNote} />
                    )}
                </div>
                {showReplies && (
                    <div className="reply-section">
                        {showReplyForm && (
                            <div className="add-reply">
                                <ContentForm closeForm={toggleReplyForm} isReply={true} onSubmit={handleReplySubmit} />
                            </div>
                        )}
                        {!showReplyForm && (<button className="button large" onClick={toggleReplyForm}>Add reply</button>)}
                        {nestedReplies.map((reply) => (
                            <Reply key={reply.reply_id} reply={reply} depth={0} isGroup={isGroup} onReplyAdded={replyAdded} onReplyRemoved={replyRemoved} postId={post.post_id} />
                        ))}
                    </div>
                )}
            </div>
        </Link>
    );
}

export default ContentWidget;

