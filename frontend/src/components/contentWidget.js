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
    if (post.poster_id === user.user_id) {
        canRemove = true;
    };

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
            await axios.post('/api/increment_views', { postId, isGroup });
        } catch (error) {
            console.error("Error incrementing views:", error);
        }
    };

    //Sorts replies by parent
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
        return nestedReplies;
    };

    //Deletes the post
    const removePost = async (isGroup, post_id) => {
        try {
            const postData = { isGroup, post_id }
            axios.delete('/api/remove_post', { data: postData });
        } catch (error) {
            console.error("Error removing post:", error); 
        }
    };

    //Updates up/downvotes
    const postVote = async (postId, voteType) => {
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
            content_id: postId, 
            isGroup,
            vote_type: voteType
        }

        if(!hasViewed) {
            incrementViews(postId);
            setHasViewed(true);
        }

        axios.post('/api/content_vote', vote)
            .catch(error => {
                console.error('Error:', error);
                if (voteType === 'upvote') {
                    setUpvotes(upvotes); 
                } else if (voteType === 'downvote') {
                    setDownvotes(downvotes); 
                }
            });
    };

    const nestedReplies = nestReplies(replies);
    const downvoteStyle = downvoteLimit ? 'downvote-disabled' : 'downvote-enabled';
    const upvoteStyle = upvoteLimit ? 'upvote-disabled' : 'upvote-enabled';

    return (
        <div className="content-item">
            <h1>{post.title}</h1>
            <div className="react-quill-container">
                <ReactQuill value={post.content} readOnly={true} theme={"bubble"} />
            </div>
            <div className="content-metadata">
                <div className="profile-info">
                    <Link className="profile-link" to={`/profile/${post[Poster].username}`}>
                        <img class="uploader-profile-image" src={`/${post[Poster].profile.profile_photo}`} alt="Profile" />
                        <p className="username">{post[Poster].username}</p>
                    </Link>
                </div>
                <div className="reply-vote-container">
                    <button className={upvoteStyle} onClick={() => postVote(post.post_id, 'upvote')}>
                        <img className="vote-arrow" src="/media/site_images/up.png" alt="upvote" />
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={downvoteStyle} onClick={() => postVote(post.post_id, 'downvote')}>
                        <img className="vote-arrow" src="/media/site_images/down.png" alt="downvote" />
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

