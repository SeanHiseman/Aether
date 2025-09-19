import axios from 'axios';
import { FaArrowDown, FaArrowUp, FaBookmark, FaCompress, FaExpand, FaRegBookmark } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../authContext';
import ContentDisplay from './contentDisplay';
import PropTypes from 'prop-types';
import useTimeAgo from '../../useTimeAgo';

const SmallContentWidget = ({ display, post }) => {
    const authContext = useContext(AuthContext);
	const { isAuthenticated = false, viewer = null } = authContext || {};
    const [downvoteLimit, setDownvoteLimit] = useState(false);
    const [downvotes, setDownvotes] = useState(post?.downvotes);
    const { post_id } = useParams();
    const fullscreenRef = useRef(null);
    const [hasCodeOrApp, setHasCodeOrApp] = useState(false); //To prevent images and text having the fullscreen button
    const [hasViewed, setHasViewed] = useState(false);
    const [isFullscreenMode, setIsFullscreenMode] = useState(false)
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isSaved, setIsSaved] = useState(post?.is_saved);
    const navigate = useNavigate();
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [savedText, setSavedText] = useState('');
    const [showFullContent, setShowFullContent] = useState(false);
    const [upvoteLimit, setUpvoteLimit] = useState(false);
    const [upvotes, setUpvotes] = useState(post?.upvotes);
    const [views, setViews] = useState(post?.views);
    const channelName = post?.parentChannel?.channel_name;
    const feedName = post?.parentChannel?.feed?.feed_name;
    const isViewingOwnPost = post?.poster_id === viewer?.feed_id;
    const timeAgo = useTimeAgo(post?.created_at || null);
    const urlPrefix = (post?.parentChannel?.feed?.is_group) ? 'g' : 'u';

    const handleLoginRedirect = () => {
        if (window.confirm ('Login to vote.')) {
            navigate('/login', { state: {from: window.location.pathname} });
        }
    };

    const incrementViews = useCallback(
        async (postId) => {
            if (!isAuthenticated || !postId || !viewer?.feed_id) return; 
            try {
                if (!hasViewed && viewer?.feed_id !== post?.poster_id) {
                    const response = await axios.post('/api/increment_views', { postId });
                    if (response.data?.success) {
                        setViews((prev) => prev + 1);
                    }
                    setHasViewed(true);
                }
            } catch (error){
                setPostErrorMessage(error.response?.data?.message || 'Error incrementing views');
                setTimeout(() => setPostErrorMessage(""), 3000);
            }
        },
        [hasViewed, post?.poster_id, viewer?.feed_id, isAuthenticated]
    );

    const postVote = async (postId, voteType) => {
        if (!isAuthenticated || !postId || !viewer?.feed_id || !voteType) return;
        try {
            const response = await axios.post('/api/content_vote', {
                postId,
                feedId: viewer?.feed_id,
                voteType,
            });
            if (response.data?.success) {
                setUpvotes(response.data?.upvotes ?? 0);
                setDownvotes(response.data?.downvotes ?? 0);
                setUpvoteLimit(response.data?.reachedUpvoteLimit);
                setDownvoteLimit(response.data?.reachedDownvoteLimit);
            } else {
                if (response.data?.message === 'upvote limit') {
                    setUpvoteLimit(true);
                } else if (response.data?.message === 'downvote limit') {
                    setDownvoteLimit(true);
                }
            }
            if (!hasViewed) {
                await incrementViews(postId);
            }
        } catch (error){
            setPostErrorMessage(error.response?.data?.error || 'Error voting');
            setTimeout(() => setPostErrorMessage(""), 3000);
        }
    };
  
    const savePost = async () => {
        const channelId = post?.parentChannel?.channel_id;
        const feedId = viewer?.feed_id;
        const postId = post?.post_id;
        if (!channelId || !feedId || !postId) {
            setSavedText('Error saving post');
            setTimeout(() => setSavedText(""), 3000);
            return;
        }
        try {
            if (isSaved) {
                await axios.delete('/api/remove_saved_post', {
                    data: { channelId, feedId, postId }
                });
            } else {
                await axios.post('/api/save_post', {
                    channelId, feedId, postId
                });
            }
            setIsSaved(!isSaved);
            setSavedText(isSaved ? "Unsaved" : "Saved");
            setTimeout(() => setSavedText(""), 3000);
        } catch (error) {
            setSavedText(error.response?.data?.error || 'Error saving post');
            setTimeout(() => setSavedText(""), 3000);
        }
    };

    useEffect(() => {
        if (!isAuthenticated || !post?.post_id || !viewer?.feed_id) return;
        const checkVoteLimit = async () => {
            try {
                const response = await axios.post('/api/content_vote', {
                    postId: post?.post_id,
                    feedId: viewer?.feed_id,
                    voteType: 'check_vote',
                });
                if (response.data.success) {
                    setUpvoteLimit(response.data?.reachedUpvoteLimit);
                    setDownvoteLimit(response.data?.reachedDownvoteLimit);
                }
            } catch (error) { 
                setPostErrorMessage(error.response?.data?.error || 'Error checking vote limit');
                setTimeout(() => setPostErrorMessage(""), 3000);
            }
        };
        checkVoteLimit();
    }, [isAuthenticated, post?.post_id, viewer?.feed_id]);

    const toggleFullscreen = () => {
        const element = fullscreenRef.current
        if (!element) return
        const request =	element.requestFullscreen
            || element.webkitRequestFullscreen
            || element.mozRequestFullScreen
            || element.msRequestFullscreen
        const exit = document.exitFullscreen
            || document.webkitExitFullscreen
            || document.mozCancelFullScreen
            || document.msExitFullscreen
        document.fullscreenElement ? exit?.call(document) : request?.call(element)
    }

    //Fullscreen handling for different browsers
    useEffect(() => {
        const handler = () =>
            setIsFullscreenMode(
                Boolean(
                    document.fullscreenElement
                    || document.webkitFullscreenElement
                    || document.mozFullScreenElement
                    || document.msFullscreenElement
                )
            )
        document.addEventListener('fullscreenchange', handler)
        document.addEventListener('webkitfullscreenchange', handler)
        document.addEventListener('mozfullscreenchange', handler)
        document.addEventListener('MSFullscreenChange', handler)
        return () => {
            document.removeEventListener('fullscreenchange', handler)
            document.removeEventListener('webkitfullscreenchange', handler)
            document.removeEventListener('mozfullscreenchange', handler)
            document.removeEventListener('MSFullscreenChange', handler)
        }
    }, [])

    const handleOverflowChange = (overflowing) => {
        setIsOverflowing(overflowing);
        if (!overflowing) {
            setShowFullContent(false);
        }
    };

    const downvoteClass = downvoteLimit ? 'vote-disabled' : 'vote-enabled';
    const upvoteClass = upvoteLimit ? 'vote-disabled' : 'vote-enabled';

    return (
        <div className="content-item">
            {postErrorMessage && <div className="error-message">{postErrorMessage}</div>}
            {/*!display && <Link
                className="title-container"
                onClick={() => incrementViews(post?.post_id)}
                style={{ display: 'block' }}
                to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`}
            >
                <span className="large-text" style={{ marginLeft: 0 }}>
                    {post?.title || '\u00A0'}
                </span>
            </Link>*/}
            <div ref={fullscreenRef} 
                className="display-div"
                style={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    ...(isFullscreenMode
                        ? { height: '100vh', overflow: 'visible' }
                        : isOverflowing
                            ? (showFullContent
                                ? { height: 'auto', overflow: 'visible' }
                                : { height: '60vh', overflow: 'hidden' })
                            : { height: 'auto', overflow: 'visible' })
                }}
            >
                <div style={isFullscreenMode ? { flex: 1, overflowY: 'auto' } : { height: '100%' }}>
                    <ContentDisplay content={post?.content} onCodeAppChange={setHasCodeOrApp} onOverflowChange={handleOverflowChange} showFullContent={showFullContent} showScrollBar={false} />
                </div>
                <div className="content-footer">
                    {(fullscreenRef.current?.requestFullscreen || fullscreenRef.current?.webkitRequestFullscreen) && hasCodeOrApp && (
                        <button className="large-icon" onClick={toggleFullscreen} title={isFullscreenMode ? "Close full-screen" : "Full-screen"}>
                            {isFullscreenMode ? <FaCompress /> : <FaExpand />}
                        </button>
                    )}
                </div>
            </div>
            <div className="content-metadata">
                <div className="feed-info">
                    <Link className="feed-link" onClick={() => incrementViews(post?.post_id)} to={display ? '/welcome' : `/u/${post?.poster?.feed_name}`}>
                        <img className="small-feed-photo" src={`/${post?.poster?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                        <p className="feed-list-text">{post?.poster?.feed_name ?? 'Anonymous'}</p>
                    </Link>
                </div>
                {!display && <Link to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`} onClick={() => incrementViews(post?.post_id)}>
                    <p className="small-text clickable faded-text">{feedName}/{channelName}</p>
                </Link>}
                <div className="vote-container">
                    {isAuthenticated || display ? (
                        !isViewingOwnPost || display ? (   
                            <div className="post-button-group">
                                <button className={`large-icon ${upvoteClass}`} disabled={upvoteLimit} onClick={() => postVote(post?.post_id, 'upvote')} title={upvoteLimit ? 'Vote limit reached' : 'Upvote'}>
                                    <FaArrowUp />
                                </button>
                                <p className="small-text">{upvotes - downvotes || 0}</p>      
                                <button className={`large-icon ${downvoteClass}`} disabled={downvoteLimit} onClick={() => postVote(post?.post_id, 'downvote')} title={downvoteLimit ? 'Vote limit reached' : 'Downvote'}>
                                    <FaArrowDown />
                                </button>
                            </div>
                        ) : (
                            <p className="small-text">{upvotes - downvotes || 0} {Math.abs(upvotes - downvotes) === 1 ? 'vote' : 'votes'}</p>
                        )
                    ) : (
                        <div className="post-button-group">
                            <button className="large-icon" onClick={handleLoginRedirect} title="Login to vote">
                                <FaArrowUp />
                            </button>
                            <span className="total-votes">{upvotes - downvotes || 0}</span>
                            <button className="large-icon" onClick={handleLoginRedirect} title="Login to vote">
                                <FaArrowDown />
                            </button>
                        </div>
                    )}
                </div>
                {isAuthenticated && (<div className="button-text-bottom">
                    <button className="large-icon" title={isSaved ? 'Unsave post' : 'Save post'} onClick={savePost}>
                        {isSaved ? <FaBookmark /> : <FaRegBookmark />}
                    </button>
                    <p className="tiny-text">{savedText}</p>
                </div>)}
                <div className="view-date-container">
                    {!display && <p className="small-text faded-text" style={{ margin: '0px' }}>{post_id ? new Date(post?.created_at).toLocaleDateString() : timeAgo}</p>}
                    <p className="small-text faded-text" style={{ margin: '0px' }}>{views || 0} {views === 1 ? 'view' : 'views'}</p>
                </div>
            </div>
        </div>
    );
};

SmallContentWidget.propTypes = {
    display: PropTypes.bool,
    post: PropTypes.object,
};

export default SmallContentWidget;