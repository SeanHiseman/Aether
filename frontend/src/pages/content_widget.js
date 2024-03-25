import axios from 'axios';
import { Link } from 'react-router-dom';
import React, { useContext, useEffect, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { AuthContext } from '../components/authContext';
import Reply from '../components/replies/reply';
import ReplyForm from '../components/replies/replyForm';

function ContentWidget({ isGroup, post }) {
    const [comments, setComments] = useState([]);
    const [downvotes, setDownvotes] = useState(post.dislikes);
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [upvotes, setUpvotes] = useState(post.likes);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const { user } = useContext(AuthContext);
    const isUploader = post.poster_id === user.user_id ? true : false;
    const Poster = isGroup ? 'GroupPoster' : 'ProfilePoster'; //Associations used by database

    useEffect(() => {
        if (showComments) {
            getComments(post.post_id);
        }
    }, [showComments, post.post_id]);

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

    const getComments = async (postId) => {
        try {
            const response = await axios.get(`/api/get_comments/${postId}?isGroup=${isGroup}`);
            setComments(response.data); 
        } catch (error) {
            console.error("Error getting comments:", error);
        }
    };

    //Updates comments after new one added
    const handleReplyAdded = (newComment) => {
        setComments(currentComments => [...currentComments, newComment]);
    };

    const handleToggleComments = () => {
        setShowComments(!showComments);
    };

    //Sorts comments in to replies
    const nestComments = (comments) => {
        const commentMap = {};
        comments.forEach(comment => commentMap[comment.comment_id] = { ...comment, replies: [] });
    
        const nestedComments = [];
        Object.values(commentMap).forEach(comment => {
            if (comment.parent_id === null) {
                nestedComments.push(comment);
            } else if (commentMap[comment.parent_id]) {
                commentMap[comment.parent_id].replies.push(comment);
            }
        });
        return nestedComments;
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

    const nestedComments = nestComments(comments);
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
                        <img className="vote-arrow" src="/media/site_images/up.png"/>
                    </button>
                    <span className="total-votes">{upvotes - downvotes}</span>
                    <button className={downvoteStyle} onClick={() => postVote(post.post_id, 'downvote')}>
                        <img className="vote-arrow" src="/media/site_images/down.png"/>
                    </button>
                </div>
                <button className="button" data-content-id={post.post_id} onClick={handleToggleComments}>
                    Replies <span className="comment-count" id={`comment-count-${post.post_id}`}>{post.comments}</span>
                </button>
                <span className="view-count">{post.views} Views</span>
                {isUploader ? (
                    <button className="button" onClick={() => removePost(isGroup, post.post_id)}>Delete</button>
                ) : null}
            </div>
            
            {showComments && (
                <div className="comment-section">
                    <div className="add-comment">
                        <ReplyForm isGroup={isGroup} onReplyAdded={handleReplyAdded} parentId={null} postId={post.post_id} />
                    </div>
                    {nestedComments.map((comment) => (
                        <Reply key={comment.comment_id} comment={comment} depth={0} isGroup={isGroup} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ContentWidget;

