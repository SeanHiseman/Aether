import axios from 'axios';
import { FaArrowDown, FaArrowUp, FaBookmark, FaChevronDown, FaChevronUp, FaComments, FaCommentSlash, FaEdit, FaEllipsisV, FaCompress, FaExpand, FaRegBookmark,  FaReply, FaTrash, FaTree, FaListUl } from 'react-icons/fa';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../authContext';
import AskButton from '../askButton';
import ContentDisplay from './contentDisplay';
import { FormatNumber } from '../../functions/formatNumber';
import ReplyTreeView from './replyTreeView';
import PropTypes from 'prop-types';
import useTimeAgo from '../../functions/useTimeAgo';

const ContentWidget = ({ canRemove = false, display = false, feed, isDraft = false, onPostRemoved, onSaveToggle = () => {}, parent, post, readOnly = false }) => {
	const authContext = useContext(AuthContext);
	const { isAuthenticated = false, viewer = null, user = null } = authContext || {};
	const [canRemoveState, setCanRemoveState] = useState(canRemove);
	const [downvoteLimit, setDownvoteLimit] = useState(false);
	const [downvotes, setDownvotes] = useState(post?.downvotes);
	const { feed_name, channel_name, post_id } = useParams();
	const location = useLocation();
	const isReplyMode = location.pathname.endsWith('/reply');
	const fullscreenRef = useRef(null);
	const [hasCodeOrApp, setHasCodeOrApp] = useState(false); //To prevent images and text having the fullscreen button
	const [hasViewed, setHasViewed] = useState(false);
	const [isFullscreenMode, setIsFullscreenMode] = useState(false)
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [isSaved, setIsSaved] = useState(post?.is_saved);
	const navigate = useNavigate();
	const [note, setNote] = useState(post?.note ? post?.note?.note_content : '');
	const [postErrorMessage, setPostErrorMessage] = useState('');
	const [replies, setReplies] = useState([]);
	const [savedText, setSavedText] = useState('');
	const [showFullContent, setShowFullContent] = useState(false);
	const [showNote, setShowNote] = useState(post?.note && post?.note?.is_misinfo);
	const [showReplies, setShowReplies] = useState(post_id ? (post?.replies > 0) : false);
	const [treeViewMode, setTreeViewMode] = useState(false);
	const [upvoteLimit, setUpvoteLimit] = useState(false);
	const [upvotes, setUpvotes] = useState(post?.upvotes);
	const [views, setViews] = useState(post?.views);
    const channelName = post?.parentChannel?.channel_name;
    const feedName = post?.parentChannel?.feed?.feed_name;
	const isReply = readOnly ? false : post?.parent_id !== null; //Read only means not displaying widget as a reply
	const isViewingOwnPost = post?.poster_id === viewer?.feed_id;
	const timeAgo = useTimeAgo(post?.created_at);
	const urlPrefix = (post?.parentChannel?.feed?.is_group) ? 'g' : 'u';

	const getReplies = useCallback(async (postId) => {
		try {
			const response = await axios.get(`/api/post_replies/${postId}`);
			const processedReplies = response.data.map(reply => ({
				...reply,
				showSubReplies: false,
				subReplies: []
			}));
			setReplies(processedReplies);
		} catch (error){
			setPostErrorMessage('Error getting replies');
			setTimeout(() => setPostErrorMessage(""), 3000);
		}
	}, []);

	const handleLoginRedirect = () => {
		if (window.confirm ('Login to vote.')) {
			navigate('/login', { state: {from: window.location.pathname} });
		}
	};

	const incrementViews = useCallback(
		async (postId) => {
			if (!isAuthenticated) return; //Only count views if user is logged in
			try {
				if (!hasViewed && (!isAuthenticated || (isAuthenticated && viewer?.feed_id !== post?.poster_id))) { //Do not add views for own content
					const response = await axios.post('/api/increment_views', { postId });
					if (response.data?.success) {
						setViews((prev) => prev + 1);
					}
					setHasViewed(true);
				}
			} catch (error) {
				setPostErrorMessage(error.response?.data?.message || 'Error incrementing views');
				setTimeout(() => setPostErrorMessage(""), 3000);
			}
		},
		[hasViewed, post?.poster_id, viewer?.feed_id]
	);

	const postVote = async (postId, voteType) => {
		if (!isAuthenticated) return;
		try {
			const response = await axios.post('/api/content_vote', {
				postId: postId,
				feedId: viewer?.feed_id,
				voteType,
			});
			if (response.data?.success) {
				setUpvotes(response.data?.upvotes);
				setDownvotes(response.data?.downvotes);
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
		} catch (error) {
			setPostErrorMessage('Error voting');
			setTimeout(() => setPostErrorMessage(""), 3000);
		}
	};

	const removePost = async () => {
		if (!isAuthenticated) return;
		const item = isReply ? "Reply" : isDraft ? "Draft" : "Post";
		if (!window.confirm(`Are you sure you want to delete this ${item}?`)) {
			return;
		}
		try {
			let url;
			let dataPayload;
			if (isDraft) {
				url = "/api/remove_draft";
				dataPayload = {
					draft: {
						draft_id: post?.draft_id,
						isPosting: false
					}
				};
			} else {
				url = "/api/remove_post";
				dataPayload = {
					post: {
						post_id: post?.post_id,
						...(post?.parent_id != null && { parent_id: post?.parent_id })
					}
				};
			}
			const response = await axios.delete(url, { data: dataPayload });
			if (response.data?.success) {
				onPostRemoved(isDraft ? post?.draft_id : post?.post_id)
				if (!isDraft) {
					if (post.parent_id) {
						navigate(`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.parent_id}`);
					} else {
						navigate(`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}`);
					}
				}
			} else {
				setPostErrorMessage(`Error removing ${item}`);
			}
		} catch (error) {
			setPostErrorMessage(`Error removing ${item}`);
			setTimeout(() => setPostErrorMessage(""), 3000);
		}
	};

	const replyRemoved = (replyId) => {
		setReplies((prevReplies) => prevReplies.filter((r) => r?.post_id !== replyId));
	};
  
	const savePost = async () => {
		if (!isAuthenticated) return;
        try {
            if (isSaved) {
                await axios.delete('/api/remove_saved_post', {
                    data: {
                        channelId: post?.parentChannel?.channel_id,
                        feedId: viewer?.feed_id,
                        postId: post?.post_id
                    }
                });
            } else {
                await axios.post('/api/save_post', {
                    channelId: post?.parentChannel?.channel_id,
                    feedId: viewer?.feed_id,
                    postId: post?.post_id
                });
            }
            setIsSaved(!isSaved);
			onSaveToggle?.(post?.post_id, !isSaved);
			setSavedText(isSaved ? "Unsaved" : "Saved");
			setTimeout(() => setSavedText(""), 3000);
        } catch (error) {
            setSavedText('Error');
			setTimeout(() => setSavedText(""), 3000);
        }
    };

	useEffect(() => {
		if (isAuthenticated && (isViewingOwnPost || feed?.isAdmin || feed?.isModerator) && !canRemoveState) {
			setCanRemoveState(true);
		}
	}, [isViewingOwnPost, feed?.isAdmin, feed?.isModerator, canRemoveState, isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated || isDraft) return;
		const checkVoteLimit = async () => {
			try {
				const response = await axios.post('/api/content_vote', {
					postId: post?.post_id,
					feedId: viewer?.feed_id,
					voteType: 'check_vote',
				});
				if (response?.data?.success) {
					setUpvoteLimit(response.data?.reachedUpvoteLimit);
					setDownvoteLimit(response.data?.reachedDownvoteLimit);
				}
			} catch (error) { 
				setPostErrorMessage('Please reload the page');
			}
		};
		checkVoteLimit();
	}, [isAuthenticated, post?.post_id, viewer?.feed_id]);

	useEffect(() => {
		if (showReplies) {
			getReplies(post?.post_id);
			if (!hasViewed) {
				incrementViews(post?.post_id);
			}
		}
	}, [getReplies, hasViewed, incrementViews, post?.post_id, showReplies]);

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

	const toggleReplies = () => {
		setShowReplies((prev) => !prev);
	};

	const toggleViewMode = () => {
		setTreeViewMode((prev) => !prev);
	};

	const handleOverflowChange = (overflowing) => {
		setIsOverflowing(overflowing);
		if (!overflowing) {
			setShowFullContent(false);
		}
	};

	const renderReplyContent = (reply) => {
		return (
			<div className="tree-reply-content">
				<div className="feed-info">
					<Link className="feed-link" to={`/u/${reply?.poster?.feed_name}`}>
						<img className="small-feed-photo" src={`/${reply?.poster?.feed_photo}`} alt="Feed" />
						<p className="feed-list-text">{reply?.poster?.feed_name}</p>
					</Link>
				</div>
				<ContentDisplay content={reply?.content} onCodeAppChange={setHasCodeOrApp} showFullContent={false} showScrollBar={false} treeViewMode={true} />
				<div className="tree-reply-footer">
					<p className="small-text">{reply?.upvotes - reply?.downvotes} votes</p>
					<Link to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}/reply`}>
						<button className="small-icon" title="Reply">
							<FaReply />
						</button>
					</Link>
					{reply?.replies > 0 && (
						<p className="small-text" style={{ margin: 0 }}>{reply?.replies} {reply?.replies === 1 ? 'reply' : 'replies'}</p>
					)}
				</div>
			</div>
		);
	};

	const downvoteClass = downvoteLimit ? 'vote-disabled' : 'vote-enabled';
	const upvoteClass = upvoteLimit ? 'vote-disabled' : 'vote-enabled';

	return (
		<div className={`content-item ${isReply ? 'reply' : ''}`}>
			{postErrorMessage && <div className="small-text faded-text">{postErrorMessage}</div>}
			{post?.title && <div className="title-container" onClick={() => incrementViews(post?.post_id)} style={{ display: 'block' }}>
				<span className="large-text" style={{ marginLeft: 0 }}>
					{post?.title || '\u00A0'}
				</span>
			</div>}
			<div ref={fullscreenRef}
				onClick={() => incrementViews(post?.post_id)}
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
				<div className="display-div" style={isFullscreenMode ? { flex: 1, overflowY: 'auto' } : { height: '100%' }}>
					<ContentDisplay post={post} onCodeAppChange={setHasCodeOrApp} onOverflowChange={handleOverflowChange} showFullContent={showFullContent} showScrollBar={false} />
				</div>
				<div className="content-footer">
					{(fullscreenRef.current?.requestFullscreen || fullscreenRef.current?.webkitRequestFullscreen) && hasCodeOrApp && (
						<button className="large-icon" onClick={toggleFullscreen} title={isFullscreenMode ? "Close full-screen" : "Full-screen"}>
							{isFullscreenMode ? <FaCompress /> : <FaExpand />}
						</button>
					)}
					{/*{isOverflowing && !isFullscreenMode && (
						<button className="small-icon" onClick={() => setShowFullContent(!showFullContent)} title={showFullContent ? 'Show less' : 'Show more'}>
							{showFullContent ? <FaChevronUp /> : <FaChevronDown />}
						</button>
					)}*/}
				</div>
			</div>
			{showNote && <div className="ask-note"><p className="ask-note-text">{note}</p></div>}
			<div className="content-metadata">
				{!isDraft && (<div className="feed-info">
					<Link className="feed-link" onClick={() => incrementViews(post?.post_id)} to={display ? '/welcome' : `/u/${post?.poster?.feed_name}`}>
						<img className="small-feed-photo" src={`/${post?.poster?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
						<p className="feed-list-text">{post?.poster?.feed_name ?? 'Anonymous'}</p>
					</Link>
				</div>)}
				{!isDraft && !display && <Link to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`} onClick={() => incrementViews(post?.post_id)}>
					<p className="small-text feed-channel-link faded-text">{feedName}/{channelName}</p>
				</Link>}
				{!isDraft && (<div className="vote-container">
					{(isAuthenticated || display) ? (
						!isViewingOwnPost ? (   
							<div className="post-button-group">
								<button className={`large-icon ${upvoteClass}`} disabled={upvoteLimit} onClick={() => postVote(post?.post_id, 'upvote')} title={upvoteLimit ? 'Vote limit reached' : 'Upvote'}>
									<FaArrowUp />
								</button>
								<p className="small-text">{FormatNumber(upvotes - downvotes)}</p>      
								<button className={`large-icon ${downvoteClass}`} disabled={downvoteLimit} onClick={() => postVote(post?.post_id, 'downvote')} title={downvoteLimit ? 'Vote limit reached' : 'Downvote'}>
									<FaArrowDown />
								</button>
							</div>
						) : (
							<p className="small-text">{FormatNumber(upvotes - downvotes)} {Math.abs(upvotes - downvotes) === 1 ? 'vote' : 'votes'}</p>
						)
					) : (
						<div className="post-button-group">
							<button className="large-icon" onClick={handleLoginRedirect} title="Login to vote">
								<FaArrowUp />
							</button>
							<p className="small-text">{FormatNumber(upvotes - downvotes)}</p>
							<button className="large-icon" onClick={handleLoginRedirect} title="Login to vote">
								<FaArrowDown />
							</button>
						</div>
					)}
				</div>)}
				{!readOnly && !isDraft && !display && (
					<div className="post-button-group reply-buttons">
						<button className="large-icon" data-content-id={post?.post_id} onClick={toggleReplies} title={showReplies ? "Close Replies" : "Show Replies"}>
							{showReplies ? <FaCommentSlash /> : <FaComments />}
							<p className="small-text" id={`reply-count-${post?.post_id}`}>{post?.replies}</p>
						</button>
						{/*{showReplies && post.replies > 0 && (
							<button className="large-icon" onClick={toggleViewMode} title={treeViewMode ? "Switch to List View" : "Switch to Tree View"}>
								{treeViewMode ? <FaListUl /> : <FaTree />}
							</button>
						)}*/}
						{isAuthenticated && !feed?.is_locked && (
							<button 
								className="large-icon" 
								disabled={readOnly} 
								onClick={() => navigate(`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}/reply`)}
								title="Reply"
							>
								<FaReply />
							</button>
						)}
					</div>
				)}
				<div className="post-button-group">
					{isAuthenticated && post?.poster_id === viewer?.feed_id && !readOnly && (
						<button 
							className="large-icon" 
							onClick={() => navigate(
								isDraft 
									? `/${urlPrefix}/${feed_name}/${channel_name}/${post?.draft_id}/edit` 
									: `/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}/edit`,
								{ state: { editData: post, isDraft: isDraft } }  
							)}
							title={isReply ? "Edit Reply" : isDraft ? "Edit draft" : "Edit Post"}
						>
							<FaEdit />
						</button>
					)}
					{isAuthenticated && canRemoveState && !readOnly && (
						<button className="large-icon" onClick={removePost} title={isReply ? "Delete Reply" : isDraft ? "Delete draft" : "Delete Post"}>
							<FaTrash />
						</button>
					)}
				</div>
				{/*{isAuthenticated && !post.note?.is_misinfo && !isDraft && (
					<AskButton content={post} isReply={false} note={note} setNote={setNote} setPostErrorMessage={setPostErrorMessage} setShowNote={setShowNote} showNote={showNote} />
				)}*/}
				{!isDraft && isAuthenticated && (
					<div className="button-text-bottom">
						<button className="large-icon" title={isSaved ? 'Unsave post' : 'Save post'} onClick={savePost}>
							{isSaved ? <FaBookmark /> : <FaRegBookmark />}
						</button>
						<p className="tiny-text">{savedText}</p>
					</div>
				)}
				<div className="view-date-container" style={{ fontFamily: 'monospace' }}>
					{!display && <p className="small-text faded-text" style={{ margin: '0px', textAlign: 'right' }}>
						{post_id ? new Date(post?.created_at).toLocaleDateString() : timeAgo}
					</p>}
					{!isDraft && (
						<p className="small-text faded-text" style={{ margin: '0px', width: '12ch', textAlign: 'right' }}>
							{FormatNumber(views)} {views === 1 ? 'view' : 'views'}
						</p>
					)}
				</div>
			</div>
			{!isReplyMode && showReplies && (
				<div className="reply-section">
					{treeViewMode ? (
						<ReplyTreeView 
							replies={replies} 
							renderReplyContent={renderReplyContent}
						/>
					) : (
						replies.length !== 0 ? (
							replies.map((reply) => (
								<ContentWidget 
									canRemove={canRemoveState} 
									feed={feed} 
									key={reply?.post_id} 
									onPostRemoved={replyRemoved} 
									post={reply} 
									readOnly={readOnly} 
								/>
							))
						) : (
							<p className="small-text faded-text" style={{ marginLeft: '5px' }}>No replies</p>
						)
					)}
					{replies.length > 0 && !treeViewMode && (
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
	onEditClick: PropTypes.func.isRequired,
	onPostRemoved: PropTypes.func.isRequired,
	onReplyClick: PropTypes.func.isRequired, 
	onSaveToggle: PropTypes.func.isRequired,
	parent: PropTypes.object,
	post: PropTypes.object.isRequired,
	readOnly: PropTypes.bool, 
};

export default ContentWidget;