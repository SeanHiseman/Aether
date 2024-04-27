import axios from 'axios';
import { Link } from 'react-router-dom';
import React, { useContext, useEffect, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { AuthContext } from './authContext';
import Reply from './replies/reply';
import ReplyForm from './replies/replyForm';

function ContentWidget({ canRemove, isGroup, post }) {
    const [replies, setReplies] = useState([]);
    const [downvotes, setDownvotes] = useState(post.downvotes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [hasViewed, setHasViewed] = useState(false);
    const [upvotes, setUpvotes] = useState(post.upvotes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const [showReplies, setShowReplies] = useState(false);
    const { user } = useContext(AuthContext);
    const Poster = isGroup ? 'GroupPoster' : 'ProfilePoster'; //Associations used by database

    //Allows users to remove their own posts
    useEffect(() => {
        if (post.poster_id === user.user_id) {
            canRemove = true;
        }
    }, [post.poster_id, user.user_id]);

    //Opens replies
    useEffect(() => {
        if (showReplies) {
            getReplies(post.post_id);
        }
    }, [showReplies, post.post_id]);
    
    //Adds a view if replies are opened
    useEffect(() => {
        if (showReplies && !hasViewed) {
            incrementViews(post.post_id);
            setHasViewed(true);
        }
    }, [showReplies, post.post_id, hasViewed]);

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

    const getReplies = async (postId) => {
        try {
            const response = await axios.get(`/api/get_replies/${postId}?isGroup=${isGroup}`);
            setReplies(response.data); 
        } catch (error) {
            console.error("Error getting replies:", error);
        }
    };

    //Updates replies after new one added
    const handleReplyAdded = (newReply) => {
        setReplies(currentReplies => [...currentReplies, newReply]);
    };

    const handleToggleReplies = () => {
        setShowReplies(!showReplies);
    };

    //Adds a view to the post
    const incrementViews = async (postId) => {
        try {
            if (hasViewed === false) {
                await axios.post('/api/increment_views', { postId, isGroup });
                setHasViewed(true);
            }
        } catch (error) {
            console.error("Error incrementing views:", error);
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
    const removePost = async (isGroup, postId) => {
        try {
            const postData = { isGroup, postId }
            axios.delete('/api/remove_post', { data: { postData } } );
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
            axios.post('/api/content_vote', { content_id: postId, isGroup, vote_type: voteType })
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
            
            if(!hasViewed) {
                incrementViews(postId);
                setHasViewed(true);
            }
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const nestedReplies = nestReplies(replies);
    const downvoteClass = downvoteLimit ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit ? 'vote-disabled' : 'vote-enabled';

    return (
        <div className="content-item">
            <h1>{post.title}</h1>
            <div className="react-quill-container">
                <ReactQuill value={post.content} readOnly={true} theme={"bubble"} />
            </div>
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
                    <button className={`vote-arrow-container ${upvoteClass}`} onClick={() => postVote(post.post_id, 'upvote')}>
                        <img className={`vote-arrow ${upvoteClass}`} src="/media/site_images/up.png" alt="upvote" />
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={`vote-arrow-container ${downvoteClass}`} onClick={() => postVote(post.post_id, 'downvote')}>
                        <img className={`vote-arrow ${downvoteClass}`} src="/media/site_images/down.png" alt="downvote" />
                    </button>
                </div>
                <button className="button" data-content-id={post.post_id} onClick={handleToggleReplies}>
                    Replies <span className="reply-count" id={`reply-count-${post.post_id}`}>{post.replies}</span>
                </button>
                <span className="view-count">{post.views} Views</span>
                {canRemove ? (
                    <button className="button" onClick={() => removePost(isGroup, post.post_id)}>Delete</button>
                ) : null}
            </div>
            
            {showReplies && (
                <div className="reply-section">
                    <div className="add-reply">
                        <ReplyForm isGroup={isGroup} onReplyAdded={handleReplyAdded} parentId={null} postId={post.post_id} />
                    </div>
                    {nestedReplies.map((reply) => (
                        <Reply key={reply.reply_id} reply={reply} depth={0} isGroup={isGroup} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

