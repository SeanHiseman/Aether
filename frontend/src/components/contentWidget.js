import axios from 'axios';
import { Link } from 'react-router-dom';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { AuthContext } from './authContext';
import AskButton from './askButton';
import ContentForm from './contentForm';
import Reply from './replies/reply';

function ContentWidget({ canRemove: canRemoveProp , isGroup, onPostRemoved, post }) {
    const [canRemove, setCanRemove] = useState(canRemoveProp);
    const [downvotes, setDownvotes] = useState(post.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [hasViewed, setHasViewed] = useState(false);
    const [note, setNote] = useState(post.note ? post.note.note_content : '');
    const [replies, setReplies] = useState([]);
    const [showNote, setShowNote] = useState(post.note && post.note.is_misinfo);
    const [showReplies, setShowReplies] = useState(false);
    const [upvotes, setUpvotes] = useState(post.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const { user } = useContext(AuthContext);
    const isViewingOwnPost = post.poster_id === user.userId; //If user is viewing a post they made
    const Poster = isGroup ? 'GroupPoster' : 'ProfilePoster'; //Associations used by database

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
                await axios.post('/api/increment_views', { postId, isGroup });
                setHasViewed(true);
            }
        } catch (error) {
            console.error("Error incrementing views:", error);
        }
    }, [hasViewed, isGroup]);
    
    //Allows users to remove their own posts
    useEffect(() => {
        if (isViewingOwnPost) {
            setCanRemove(true);
        }
    }, [post.poster_id, user.userId]);

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
                const response = await axios.post('/api/content_vote', { content_id: post.post_id, isGroup, vote_type: 'check_vote' });

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

    //Updates replies after new one added
    const handleReplyAdded = (newReply) => {
        setReplies(currentReplies => [...currentReplies, newReply]);
    };

    const handleReplySubmit = async (formData) => {
        try {
            //Send the form data to the server
            const response = await axios.post('/api/add_reply', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.status === "success") {
                //Add the new reply to the local state
                setReplies(currentReplies => [...currentReplies, response.data.reply]);
            } else {
                console.error("Failed to add reply:", response.data.message);
            }
        } catch (error) {
            console.error("Error adding reply:", error);
        }
    };

    const handleToggleReplies = () => {
        setShowReplies(!showReplies);
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
            const postData = { isGroup, postId: post.post_id };
            const response = axios.delete('/api/remove_post', { data: { postData } } );
            if ((await response).data.success) {
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
                const response = await axios.post('/api/content_vote', { content_id: postId, isGroup, vote_type: voteType });
    
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
    
    const nestedReplies = nestReplies(replies);
    const downvoteClass = downvoteLimit || isViewingOwnPost ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit || isViewingOwnPost ? 'vote-disabled' : 'vote-enabled';

    return (
        <div className="content-item">
            <h1>{post.title}</h1>
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
                    {post[Poster] && post[Poster].username && post[Poster].profile && post[Poster].profile.profile_photo ? (
                        <Link className="profile-link" to={`/profile/${post[Poster].username}`} onClick={() => incrementViews(post.post_id)}>
                            <img className="uploader-profile-image" src={`/${post[Poster].profile.profile_photo}`} alt="Profile" />
                            <p className="username">{post[Poster].username}</p>
                        </Link>
                    ) : (
                        <p>Unknown user</p>
                    )}
                </div>
                <div className="reply-vote-container">
                    <button className={`vote-arrow-container ${upvoteClass}`} onClick={() => postVote(post.post_id, 'upvote')} disabled={isViewingOwnPost}>
                        <img className={`vote-arrow ${upvoteClass}`} src="/media/site_images/up.png" alt="upvote" />
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={`vote-arrow-container ${downvoteClass}`} onClick={() => postVote(post.post_id, 'downvote')} disabled={isViewingOwnPost}>
                        <img className={`vote-arrow ${downvoteClass}`} src="/media/site_images/down.png" alt="downvote" />
                    </button>
                </div>
                <button className="button" data-content-id={post.post_id} onClick={handleToggleReplies}>
                    Replies <span className="reply-count" id={`reply-count-${post.post_id}`}>{post.replies}</span>
                </button>
                <span className="view-count">{post.views} Views</span>
                <p>{new Date(post.timestamp).toLocaleDateString()}</p>
                {canRemove ? (
                    <button className="button" onClick={() => removePost(isGroup, post.post_id)}>Delete</button>
                ) : null}
                {!post.note?.is_misinfo && (
                    <AskButton isGroup={isGroup} isReply={false} content={post} showNote={showNote} setShowNote={setShowNote} note={note} setNote={setNote} />
                )}
            </div>
            
            {showReplies && (
                <div className="reply-section">
                    <div className="add-reply">
                        <ContentForm isGroup={isGroup} isReply={true} onSubmit={handleReplySubmit} postId={post.post_id} parentId={null} />
                    </div>
                    {nestedReplies.map((reply) => (
                        <Reply key={reply.reply_id} reply={reply} depth={0} isGroup={isGroup} onReplyAdded={handleReplyAdded}/>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

