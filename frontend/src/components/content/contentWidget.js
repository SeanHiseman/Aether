import axios from 'axios';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaComments, FaCommentSlash, FaEdit, FaReply, FaTimesCircle } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../authContext';
import AskButton from '../askButton';
import ContentDisplay from './contentDisplay';
import PropTypes from 'prop-types';

const ContentWidget = ({ canRemove, feed, isGroup, onEditClick, onPostRemoved, onReplyClick, parent, post, readOnly = false }) => {
  const [downvoteLimit, setDownvoteLimit] = useState(false);
  const [downvotes, setDownvotes] = useState(post.downvotes);
  const { feed_name, channel_name, post_id } = useParams();
  const [hasViewed, setHasViewed] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const navigate = useNavigate();
  const [note, setNote] = useState(post.note ? post.note.note_content : '');
  const [postErrorMessage, setPostErrorMessage] = useState('');
  const [replies, setReplies] = useState([]);
  const [showFullContent, setShowFullContent] = useState(false);
  const [showNote, setShowNote] = useState(post.note && post.note.is_misinfo);
  const [showReplies, setShowReplies] = useState(post_id ? (post.replies > 0) : false);
  const [upvoteLimit, setUpvoteLimit] = useState(false);
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const [views, setViews] = useState(post.views);
  const { user, viewer } = useContext(AuthContext);
  const isReply = readOnly ? false : post.parent_id !== null; //Read only means not displaying widget as a reply
  const isViewingOwnPost = post.poster_id === viewer.feed_id;
  const urlPrefix = isGroup ? 'g' : 'u';

  const getReplies = useCallback(async (postId) => {
    try {
      const response = await axios.get(`/api/post_replies/${postId}`);
      setReplies(response.data);
    } catch {
      setPostErrorMessage('Error getting replies');
    }
  }, []);

  const incrementViews = useCallback(
    async (postId) => {
      try {
        if (!hasViewed && viewer.feed_id !== post.poster_id) {
          const response = await axios.post('/api/increment_views', { postId });
          if (response.data.success) {
            setViews((prev) => prev + 1);
          }
          setHasViewed(true);
        }
      } catch {
        setPostErrorMessage('Error incrementing views');
      }
    },
    [hasViewed, post.poster_id, viewer.feed_id]
  );

  const postVote = async (postId, voteType) => {
    try {
      if (
        (voteType === 'upvote' && upvoteLimit) ||
        (voteType === 'downvote' && downvoteLimit)
      ) {
        return;
      }
      setDownvoteLimit(false);
      setUpvoteLimit(false);
      const response = await axios.post('/api/content_vote', {
        postId: postId,
        feedId: feed.feed_id,
        voteType,
      });
      if (response.data.success) {
        if (voteType === 'upvote') {
          setUpvotes((prev) => prev + 1);
        } else {
          setDownvotes((prev) => prev + 1);
        }
      } else {
        if (voteType === 'upvote') {
          setUpvoteLimit(true);
        } else {
          setDownvoteLimit(true);
        }
      }
      if (!hasViewed) {
        await incrementViews(postId);
      }
    } catch {
      setPostErrorMessage('Error voting');
    }
  };

  const removePost = async () => {
    if (window.confirm(`Are you sure you want to delete this ${isReply ? 'Relpy' : 'Post'}?`)) {
      try {
        const response = await axios.delete('/api/remove_post', { data: { post } });
        if (response.data.success) {
          onPostRemoved(post.post_id);
          navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
        }
      } catch (error) {
        console.log("error:", error);
        setPostErrorMessage(`Error removing ${isReply ? 'Relpy' : 'Post'}`);
      }
    }
  };

  const replyRemoved = (replyId) => {
    setReplies((prevReplies) => prevReplies.filter((r) => r.post_id !== replyId));
  };

  useEffect(() => {
    if ((isViewingOwnPost || feed.isAdmin || feed.isModerator) && !canRemove) {
      canRemove = true;
    }
  }, [isViewingOwnPost, feed.isAdmin, feed.isModerator, canRemove]);

  useEffect(() => {
    const checkVoteLimit = async () => {
      try {
        const response = await axios.post('/api/content_vote', {
          postId: post.post_id,
          feedId: viewer.feed_id,
          voteType: 'check_vote',
        });
        if (response.data.message === 'upvote limit') {
          setUpvoteLimit(true);
        } else if (response.data.message === 'downvote limit') {
          setDownvoteLimit(true);
        }
      } catch {
        setPostErrorMessage('Error checking vote limit');
      }
    };
    checkVoteLimit();
  }, [post.post_id, viewer.feed_id]);

  useEffect(() => {
    if (showReplies) {
      getReplies(post.post_id);
      if (!hasViewed) {
        incrementViews(post.post_id);
      }
    }
  }, [getReplies, hasViewed, incrementViews, post.post_id, showReplies]);

  const toggleReplies = () => {
    setShowReplies((prev) => !prev);
  };

  const handleOverflowChange = (overflowing) => {
    setIsOverflowing(overflowing);
    if (!overflowing) {
      setShowFullContent(false);
    }
  };

  const downvoteClass = downvoteLimit ? 'vote-disabled' : 'vote-enabled';
  const upvoteClass = upvoteLimit ? 'vote-disabled' : 'vote-enabled';

  return (
    <div className={`content-item ${isReply ? 'reply' : ''}`}>
      {postErrorMessage && <div className="error-message">{postErrorMessage}</div>}
      {post.title && (
        <div className="title-container">
          <Link className="text36" style={{ marginLeft: 0 }} to={`/${urlPrefix}/${feed.feed_name}/${post.parentChannel.channel_name}/${post.post_id}`} onClick={() => incrementViews(post.post_id)}>
            {post.title}
          </Link>
          {post.displayGroupName && (
            <Link className="feed-link" to={`/g/${feed.feed_name}`}>
              <p className="feed-list-text">{feed.feed_name}</p>
              <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed" />
            </Link>
          )}
        </div>
      )}
      <ContentDisplay content={post.content} onOverflowChange={handleOverflowChange} showFullContent={showFullContent} showScrollBar={false} />
      {isOverflowing && (
        <button className="small-icon" onClick={() => setShowFullContent(!showFullContent)} title={showFullContent ? 'Show less' : 'Show more'}>
          {showFullContent ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      )}
      {showNote && <div className="ask-note"><p className="ask-note-text">{note}</p></div>}
      <div className="content-metadata">
        <div className="feed-info">
          <Link className="feed-link" onClick={() => incrementViews(post.post_id)} to={`/u/${post.poster.feed_name}`}>
            <img className="small-feed-photo" src={`/${post.poster.feed_photo}`} alt="Feed" />
            <p className="feed-list-text">{post.poster.feed_name}</p>
          </Link>
        </div>
        <div className="vote-container">
          {!isViewingOwnPost &&   
            <button className={`large-icon ${upvoteClass}`} disabled={downvoteLimit || upvoteLimit} onClick={() => postVote(post.post_id, 'upvote')}>
              <FaArrowUp />
            </button>}
            <span className="total-votes">{upvotes - downvotes} {Math.abs(upvotes - downvotes) === 1 && 'vote'}</span>
          {!isViewingOwnPost &&           
            <button className={`large-icon ${downvoteClass}`} disabled={downvoteLimit || upvoteLimit} onClick={() => postVote(post.post_id, 'downvote')} >
              <FaArrowDown />
            </button>}
        </div>
        {!readOnly && (
          <>
            <button className="large-icon" data-content-id={post.post_id} onClick={toggleReplies} title={showReplies ? "Close Replies" : "Show Replies"}>
              {showReplies ? <FaCommentSlash /> : <FaComments />}
              <p className="text16" id={`reply-count-${post.post_id}`}>{post.replies}</p>
            </button>
            <button className="large-icon" onClick={() => onReplyClick(post)} disabled={readOnly} title="Reply">
              <FaReply />
            </button>
          </>
        )}
        <p className="text16">{views} {views === 1 ? 'view' : 'views'}</p>
        <p className="text16">{new Date(post.timestamp).toLocaleDateString()}</p>
        {post.poster_id === viewer.feed_id && !readOnly && (
          <button className="large-icon" onClick={() => onEditClick(post)} title={isReply ? "Edit Reply" : "Edit Post"}>
            <FaEdit />
          </button>
        )}
        {canRemove && !readOnly && (
          <button className="large-icon" onClick={removePost} title={isReply ? "Delete Reply" : "Delete Post"}>
            <FaTimesCircle />
          </button>
        )}
        {!post.note?.is_misinfo && (
          <AskButton content={post} isGroup={isGroup} isReply={false} note={note} setNote={setNote} setPostErrorMessage={setPostErrorMessage} setShowNote={setShowNote} showNote={showNote} />
        )}
      </div>
      {showReplies && (
        <div className="reply-section">
          {replies.length !== 0 ? (
            replies.map((reply) => (
              <ContentWidget canRemove={canRemove} feed={feed} isGroup={isGroup} key={reply.post_id} onEditClick={onEditClick} onPostRemoved={replyRemoved} onReplyClick={onReplyClick} post={reply} readOnly={readOnly} />
            ))
          ) : (
            <p className="text24">No replies</p>
          )}
          {replies.length > 0 && (
            <div className="replies-footer">
              <button className="small-icon" onClick={toggleReplies} title="Close Replies">
                <FaChevronUp />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ContentWidget.propTypes = {
  canRemove: PropTypes.bool.isRequired,
  feed: PropTypes.object.isRequired,
  isGroup: PropTypes.bool.isRequired,
  onEditClick: PropTypes.func.isRequired,
  onPostRemoved: PropTypes.func.isRequired,
  onReplyClick: PropTypes.func.isRequired, 
  parent: PropTypes.object,
  post: PropTypes.object.isRequired,
  readOnly: PropTypes.bool, 
};

export default ContentWidget;