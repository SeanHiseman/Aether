import axios from 'axios';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaComments, FaEdit, FaReply, FaTimesCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Quill } from 'react-quill';
import { AuthContext } from '../authContext';
import AskButton from '../askButton';
import ContentDisplay from './contentDisplay';
import ContentForm from './contentForm';

const ContentWidget = ({ canRemove: canRemoveProp, feed, isGroup, onEditClick, onPostRemoved, parent, post }) => {
    const [canRemove, setCanRemove] = useState(canRemoveProp);
    const [downvotes, setDownvotes] = useState(post.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [hasViewed, setHasViewed] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [note, setNote] = useState(post.note ? post.note.note_content : '');
    const [replies, setReplies] = useState([]);
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [showFullContent, setShowFullContent] = useState(false);
    const [showNote, setShowNote] = useState(post.note && post.note.is_misinfo);
    const [showReplies, setShowReplies] = useState(false);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [upvotes, setUpvotes] = useState(post.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const { user, viewer } = useContext(AuthContext);
    const [views, setViews] = useState(post.views);
    const isReply = post.parent_id !== null;
    const isViewingOwnPost = post.poster_id === viewer.feed_id; 
    const urlLetter = isGroup ? 'g' : 'u';

    const getReplies = useCallback(async (postId) => {
        try {
            const response = await axios.get(`/api/post_replies/${postId}`);
            setReplies(response.data); 
        } catch (error) {
            setPostErrorMessage("Error getting replies");
        }
    }, []);
    
    //Allows removal of own posts
    useEffect(() => {
        if (isViewingOwnPost || feed.isAdmin || feed.isModerator) {
            setCanRemove(true);
        } else {
            setCanRemove(false)
        }
    }, [isViewingOwnPost, feed.isAdmin, feed.isModerator]);

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
                const response = await axios.post('/api/content_vote', { contentId: post.post_id, feedId: viewer.feed_id, voteType: 'check_vote' });
                if (response.data.message === 'upvote limit') {
                    setUpvoteLimit(true);
                } else if (response.data.message === 'downvote limit') {
                    setDownvoteLimit(true);
                }
            } catch (error) {
                setPostErrorMessage('Error checking vote limit');
            }
        };
        checkVoteLimit();
    }, [viewer.feed_id, post.post_id]);

    //Adds a view to the post if not viewing own post and haven't already viewed
    const incrementViews = useCallback(async (postId) => {
        try {
            if (hasViewed === false && viewer.feed_id !== post.poster_id) {
                const response = await axios.post('/api/increment_views', { postId });
                if (response.data.success) {
                    setViews((prev) => prev + 1);
                }
                setHasViewed(true);
            }
        } catch (error) {
            setPostErrorMessage("Error incrementing views");
        }
    }, [hasViewed, views, viewer.feed_id, post.poster_id]);

    //Allows React Quill to display videos
    //const BlockEmbed = Quill.import('blots/block/embed');
    //class VideoBlot extends BlockEmbed {
        //static create(value) {
            //let node = super.create();
            //node.setAttribute('src', value.url);
            //node.setAttribute('controls', true);
            //return node;
        //}
        //static value(node) {
            //return { url: node.getAttribute('src') };
        //}
    //}
    //VideoBlot.blotName = 'video';
    //VideoBlot.tagName = 'video';
    //Quill.register(VideoBlot);

    const replyRemoved = (replyId) => {
        setReplies((prevReplies) => prevReplies.filter((reply) => reply.post_id !== replyId));
    };

    const handleReplySubmit = async (formData) => {
        if (!formData) {
            setPostErrorMessage("Reply cannot be empty");
            return;
        }
        try {
            formData.append('feed_id', post.feed_id);
            formData.append('channel_id', post.channel_id);
            formData.append('poster_id', viewer.feed_id);
            const response = await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success === true && response.data.post) {
                const newReply = response.data.post;
                newReply.parentChannel = {
                    channel_name: post.parentChannel?.channel_name ?? ''
                };
                newReply.poster = {
                    feed_name: viewer.feed_name,
                    feed_photo: viewer.feed_photo,
                };
                newReply.upvotes = newReply.upvotes || 0;
                newReply.downvotes = newReply.downvotes || 0;
                newReply.views = newReply.views || 0;
                newReply.replies = newReply.replies || 0;
                newReply.timestamp = newReply.timestamp || new Date().toISOString();
                setReplies(currentReplies => [...currentReplies, newReply]);
                setShowReplyForm(false);
            } else {
                setPostErrorMessage("Error adding reply");
            }
        } catch (error) {
            setPostErrorMessage("Error adding reply");
        }
    };

    //Sorts replies by parent and by net upvotes
    //const nestReplies = (replies) => {
        //const replyMap = {};
        //replies.forEach(reply => replyMap[reply.post_id] = { ...reply, replies: [] });
        //const nestedReplies = [];
        //Object.values(replyMap).forEach(reply => {
            //if (reply.parent_id === null) {
                //nestedReplies.push(reply);
            //} else if (replyMap[reply.parent_id]) {
                //replyMap[reply.parent_id].replies.push(reply);
            //}
        //});
        //const sortByNetUpvotes = (a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
        //const sortedReplies = nestedReplies.map(reply => {
            //const sortedChildReplies = [...reply.replies].sort(sortByNetUpvotes);
            //return { ...reply, replies: sortedChildReplies };
        //})
        //return sortedReplies.sort(sortByNetUpvotes);
    //};

    const removePost = async () => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            try {
                const response = await axios.delete('/api/remove_post', { 
                    data: { post: post } 
                });
                if (response.data.success) {
                    onPostRemoved(post.post_id);
                }
            } catch (error) {
                setPostErrorMessage("Error removing post"); 
            }
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
                const response = await axios.post('/api/content_vote', { contentId: postId, feedId: feed.feed_id, voteType: voteType });
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
                setPostErrorMessage('Error voting');
            }
            if (!hasViewed) {
                incrementViews(postId);
                setHasViewed(true);
            }
        } catch (error) {
            setPostErrorMessage('Error voting');
        }
    };
 
    const toggleReplies = () => { setShowReplies(prev => !prev) };
    //const nestedReplies = nestReplies(replies);
    const downvoteClass = downvoteLimit || isViewingOwnPost ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit || isViewingOwnPost ? 'vote-disabled' : 'vote-enabled';

    return (
        <div className={`content-item ${isReply ? 'reply' : ''}`}>
            {postErrorMessage && (<div className="error-message">{postErrorMessage}</div>)}
            {post.title && (<div className="title-container">
                <Link to={`/${urlLetter}/${feed.feed_name}/${post.parentChannel.channel_name}/${post.post_id}`}className="text36">{post.title}</Link>
                {post.displayGroupName && (
                    <Link className="feed-link" to={`/g/${feed.feed_name}`}>
                        <p className="feed-list-text">{feed.feed_name}</p>
                        <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed" />
                    </Link>
                )}
            </div>)}
            <ContentDisplay content={post.content} onOverflowChange={setIsOverflowing} showFullContent={showFullContent} showScrollBar={false}/>
            {isOverflowing && (
                <button className="small-icon" onClick={() => setShowFullContent(!showFullContent)}>
                    {showFullContent ? <FaChevronUp /> : <FaChevronDown />}
                </button>
            )}
            {showNote && (
                <div className="ask-note">
                    <p className="ask-note-text">{note}</p>
                </div>
            )}
            <div className="content-metadata">
                <div className="feed-info">
                    <Link className="feed-link" to={`/u/${post.poster.feed_name}`} onClick={() => incrementViews(post.post_id)}>
                        <img className="small-feed-photo" src={`/${post.poster.feed_photo}`} alt="Feed" />
                        <p className="feed-list-text">{post.poster.feed_name} </p>
                    </Link>
                </div>
                <div className="vote-container">
                    <button className={`large-icon ${upvoteClass}`} onClick={() => postVote(post.post_id, 'upvote')} disabled={isViewingOwnPost}>
                        <FaArrowUp />
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={`large-icon ${downvoteClass}`} onClick={() => postVote(post.post_id, 'downvote')} disabled={isViewingOwnPost}>
                        <FaArrowDown />
                    </button>
                </div>
                <button className="large-icon" data-content-id={post.post_id} onClick={toggleReplies}>
                    <FaComments />
                    <p className="text16" id={`reply-count-${post.post_id}`}>{post.replies}</p>
                </button>
                <p className="text16">{views} {views === 1 ? 'view' : 'views'}</p>
                <p className="text16">{new Date(post.timestamp).toLocaleDateString()}</p>
                {post.poster_id === viewer.feed_id && (
                    <button className="large-icon" onClick={() => onEditClick(post)}>
                        <FaEdit />
                    </button>
                )}
                {canRemove ? (
                    <button className="large-icon" onClick={() => removePost(isGroup, post.post_id)}>
                        <FaTimesCircle />
                    </button>
                ) : null}
                {!post.note?.is_misinfo && (
                    <AskButton isGroup={isGroup} isReply={false} content={post} showNote={showNote} setShowNote={setShowNote} note={note} setNote={setNote} setPostErrorMessage={setPostErrorMessage} />
                )}
            </div>
            {showReplies && (
                <div className="reply-section">
                    {showReplyForm ? (
                        <div className="add-reply">
                            <ContentForm isReply={true} onSubmit={handleReplySubmit} post={post} setShowForm={setShowReplyForm}/>
                        </div>
                    ) : (
                        <button className="small-icon" onClick={() => setShowReplyForm(true)}>
                            <FaReply />
                            Add reply
                        </button>
                    )}
                    {replies.map((reply) => (
                        <ContentWidget key={reply.post_id} canRemove={canRemove} feed={feed} isGroup={isGroup} onEditClick={onEditClick} onPostRemoved={replyRemoved} parent={post} post={reply} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

