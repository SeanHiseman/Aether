import axios from 'axios';
import { Link } from 'react-router-dom';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Quill } from 'react-quill';
import { AuthContext } from '../authContext';
import AskButton from '../askButton';
import ContentDisplay from './contentDisplay';
import ContentForm from './contentForm';

const ContentWidget = ({ canRemove: canRemoveProp, feed, isGroup, onEditClick, onPostRemoved, post, postErrorMessage, setPostErrorMessage }) => {
    const [canRemove, setCanRemove] = useState(canRemoveProp);
    const [downvotes, setDownvotes] = useState(post.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [hasViewed, setHasViewed] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [note, setNote] = useState(post.note ? post.note.note_content : '');
    const [replies, setReplies] = useState([]);
    const [showFullContent, setShowFullContent] = useState(false);
    const [showNote, setShowNote] = useState(post.note && post.note.is_misinfo);
    const [showReplies, setShowReplies] = useState(false);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [upvotes, setUpvotes] = useState(post.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const isViewingOwnPost = post.poster_id === feed.feed_id; 
    const { user, viewer } = useContext(AuthContext);
    const urlLetter = isGroup ? 'g' : 'u';

    const getReplies = useCallback(async (postId) => {
        try {
            const response = await axios.get(`/api/post_replies/${postId}`);
            setReplies(response.data); 
        } catch (error) {
            setPostErrorMessage("Error getting replies");
        }
    });
    
    //Allows removal of own posts
    useEffect(() => {
        if (isViewingOwnPost) {
            setCanRemove(true);
        }
    }, [isViewingOwnPost, post.poster_id, user.userId]);

    useEffect(() => {
        if (showReplies) {
            getReplies(post.post_id);
        }
    }, [getReplies, post.post_id, showReplies]);
    
    //Adds a view if replies are opened
    //useEffect(() => {
        //if (showReplies && !hasViewed) {
            //incrementViews(post.post_id);
            //setHasViewed(true);
        //}
    //}, [hasViewed, incrementViews, post.post_id, showReplies]);
 
    //Sets the upvote/downvote limits upon rendering
    useEffect(() => {
        const checkVoteLimit = async () => {
            try {
                const response = await axios.post('/api/content_vote', { contentId: post.post_id, feedId: feed.feed_id, voteType: 'check_vote' });
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
    }, [feed.feedId, post.post_id, isGroup]);

    //Adds a view to the post
    const incrementViews = useCallback(async (postId) => {
        try {
            if (hasViewed === false) {
                await axios.post('/api/increment_views', { postId });
                setHasViewed(true);
            }
        } catch (error) {
            setPostErrorMessage("Error incrementing views");
        }
    }, [hasViewed]);

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
            if (response.data.success === true) {
                //Add the new reply to the local state
                setReplies(currentReplies => [...currentReplies, response.data.reply]);
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
        try {
            const response = await axios.delete('/api/remove_post', { 
                data: { postId: post.post_id } 
            });
            if (response.data.success) {
                onPostRemoved(post.post_id);
            }
        } catch (error) {
            setPostErrorMessage("Error removing post"); 
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
        <div className="content-item">
            {postErrorMessage && (<div className="error-message">{postErrorMessage}</div>)}
            <div className="title-container">
                <Link to={`/${urlLetter}/${feed.feed_name}/${post.parentChannel.channel_name}/${post.post_id}`}className="text36">{post.title}</Link>
                {post.displayGroupName && (
                    <Link className="feed-link" to={`/g/${feed.feed_name}`}>
                        <p className="feed-list-text">{feed.feed_name}</p>
                        <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed" />
                    </Link>
                )}
            </div>
            <ContentDisplay content={post.content} onOverflowChange={setIsOverflowing} showFullContent={showFullContent} showScrollBar={false}/>
            {isOverflowing && (
                <button className="button" onClick={() => setShowFullContent(!showFullContent)}>
                    {showFullContent ? 'Show less' : 'Show more'}
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
                    <button className={`vote-arrow-container ${upvoteClass}`} onClick={() => postVote(post.post_id, 'upvote')} disabled={isViewingOwnPost}>
                        <img className={`vote-arrow ${upvoteClass}`} src="/media/site_images/up.png" alt="upvote" />
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={`vote-arrow-container ${downvoteClass}`} onClick={() => postVote(post.post_id, 'downvote')} disabled={isViewingOwnPost}>
                        <img className={`vote-arrow ${downvoteClass}`} src="/media/site_images/down.png" alt="downvote" />
                    </button>
                </div>
                <button className="button" data-content-id={post.post_id} onClick={toggleReplies}>
                    <p className="text16" id={`reply-count-${post.post_id}`}>{post.replies} Replies</p>
                </button>
                <p className="text16">{post.views} Views</p>
                <p className="text16">{new Date(post.timestamp).toLocaleDateString()}</p>
                {post.poster_id === viewer.feed_id && (
                    <button className="button" onClick={() => onEditClick(post)}>Edit</button>
                )}
                {canRemove ? (
                    <button className="button" onClick={() => removePost(isGroup, post.post_id)}>Delete</button>
                ) : null}
                {!post.note?.is_misinfo && (
                    <AskButton isGroup={isGroup} isReply={false} content={post} showNote={showNote} setShowNote={setShowNote} note={note} setNote={setNote} />
                )}
            </div>
            {showReplies && (
                <div className="reply-section">
                    {showReplyForm ? (
                        <div className="add-reply">
                            <ContentForm isReply={true} onSubmit={handleReplySubmit} post={post} postErrorMessage={postErrorMessage} setPostErrorMessage={setPostErrorMessage} setShowForm={setShowReplyForm}/>
                        </div>
                    ) : (
                        <button className="button" onClick={() => setShowReplyForm(true)}>Add reply</button>
                    )}
                    {replies.map((reply) => (
                        <ContentWidget key={reply.post_id} canRemove={canRemove} feed={feed} isGroup={isGroup} onEditClick={onEditClick} onPostRemoved={replyRemoved} post={reply} postErrorMessage={postErrorMessage} setPostErrorMessage={setPostErrorMessage}/>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

