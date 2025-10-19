import api from '../../api';
import { FaArrowDown, FaArrowUp, FaBookmark, FaChevronDown, FaChevronUp, FaComments, FaCommentSlash, FaEdit, FaCompress, FaExpand, FaRegBookmark,  FaReply, FaTrash, FaTree, FaListUl } from 'react-icons/fa';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../authContext';
import AskButton from '../askButton';
import ContentDisplay from './contentDisplay';
import ConfirmModal from '../modals/confirmModal';
import { FormatNumber } from '../../functions/formatNumber';
import ReplyTreeView from './replyTreeView';
import PropTypes from 'prop-types';
import useTimeAgo from '../../functions/useTimeAgo';

const ContentWidget = ({ canRemove = false, display = false, feed, isDraft = false, onPostRemoved, onSaveToggle = () => {}, parent, post, readOnly = false }) => {
	const authContext = useContext(AuthContext);
	const { isAuthenticated = false, viewer = null, user = null } = authContext || {};
	const [canRemoveState, setCanRemoveState] = useState(canRemove);
	const [contentHeight, setContentHeight] = useState(0);
	const [downvotes, setDownvotes] = useState(post?.downvotes);
	const { feed_name, channel_name, post_id } = useParams();
	const location = useLocation();
	const isReplyMode = location.pathname.endsWith('/reply');
	const fullscreenRef = useRef(null);
	const [hasCodeOrApp, setHasCodeOrApp] = useState(false); //To prevent images and text having the fullscreen button
	const [hasUpvoted, setHasUpvoted] = useState(post?.has_upvoted || false);
    const [hasDownvoted, setHasDownvoted] = useState(post?.has_downvoted || false);
	const [hasViewed, setHasViewed] = useState(false);
	const [isFullscreenMode, setIsFullscreenMode] = useState(false)
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [isSaved, setIsSaved] = useState(post?.is_saved);
	const navigate = useNavigate();
	const [note, setNote] = useState(post?.note ? post?.note?.note_content : '');
	const [pendingDeleteAction, setPendingDeleteAction] = useState(null);
	const [postErrorMessage, setPostErrorMessage] = useState('');
	const [replies, setReplies] = useState([]);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showExpandButton, setShowExpandButton] = useState(false);
	const [showFullContent, setShowFullContent] = useState(false);
	const [showNote, setShowNote] = useState(post?.note && post?.note?.is_misinfo);
	const [showReplies, setShowReplies] = useState(post_id ? (post?.replies > 0) : false);
	const [treeViewMode, setTreeViewMode] = useState(false);
	const [upvotes, setUpvotes] = useState(post?.upvotes);
	const [views, setViews] = useState(post?.views);
    const channelName = post?.parentChannel?.channel_name;
    const feedName = post?.parentChannel?.feed?.feed_name;
	const isReply = readOnly ? false : post?.parent_id !== null; //Read only means not displaying widget as a reply
	const isViewingOwnPost = post?.poster_id === viewer?.feed_id;
	const timeAgo = useTimeAgo(post?.created_at);
	const urlPrefix = (post?.parentChannel?.feed?.is_group) ? 'g' : 'u';
	const contentContainerRef = useRef(null);

	const confirmDelete = async () => {
		setShowDeleteConfirm(false);
		try {
			let url;
			let dataPayload;
			if (isDraft) {
				url = "/remove_draft";
				dataPayload = {
					draft: { draft_id: post?.draft_id, isPosting: false }
				};
			} else {
				url = "/remove_post";
				dataPayload = {
					post: { post_id: post?.post_id, ...(post?.parent_id != null && { parent_id: post?.parent_id })}
				};
			}
			const response = await api.delete(url, { data: dataPayload });
			if (response.data?.success) {
				onPostRemoved(isDraft ? post?.draft_id : post?.post_id)
				if (!isDraft) {
					if (post?.parent_id) {
						navigate(`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.parent_id}`);
					} else {
						navigate(`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}`);
					}
				}
			} else {
				setPostErrorMessage(`Error removing ${pendingDeleteAction}`);
			}
		} catch (error) {
			setPostErrorMessage(error.response.data?.message || `Error removing ${pendingDeleteAction}`);
			setTimeout(() => setPostErrorMessage(""), 3000);
		}
		setPendingDeleteAction(null);
	};

	const cancelDelete = () => {
		setShowDeleteConfirm(false);
		setPendingDeleteAction(null);
	};

	const deleteClick = () => {
		const item = isReply ? "reply" : isDraft ? "draft" : "post";
		setPendingDeleteAction(item);
		setShowDeleteConfirm(true);
	};

	const getReplies = useCallback(async (postId) => {
		try {
			const response = await api.get(`/post_replies/${postId}`);
			const processedReplies = response.data.map(reply => ({
				...reply,
				showSubReplies: false,
				subReplies: []
			}));
			setReplies(processedReplies);
		} catch (error){
			setPostErrorMessage(error.response.data?.message || 'Error getting replies');
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
					const response = await api.post('/increment_views', { postId });
					if (response.data?.success) {
						setViews((prev) => prev + 1);
					}
					setHasViewed(true);
				}
			} catch (error) {
				setPostErrorMessage(error.response.data?.message || 'Error incrementing views');
				setTimeout(() => setPostErrorMessage(""), 3000);
			}
		},
		[hasViewed, post?.poster_id, viewer?.feed_id]
	);

    const postVote = async (postId, voteType) => {
        if (!isAuthenticated) return;
        try {
            const response = await api.post('/content_vote', {
                postId: postId,
                feedId: viewer?.feed_id,
                voteType,
            });
            if (response.data?.success) {
                setUpvotes(response.data?.upvotes);
                setDownvotes(response.data?.downvotes);
                if (voteType === 'upvote') {
                    setHasUpvoted(!hasUpvoted);
                    setHasDownvoted(false);
                } else if (voteType === 'downvote') {
                    setHasDownvoted(!hasDownvoted);
                    setHasUpvoted(false);
                }
                if (voteType === 'upvote' && !hasUpvoted) {
                    const storedUpvotes = JSON.parse(localStorage.getItem('recentUpvotes') || '[]');
                    const updatedUpvotes = [{ post_id: postId }, ...storedUpvotes];
                    const trimmedUpvotes = updatedUpvotes.slice(0, 100);
                    localStorage.setItem('recentUpvotes', JSON.stringify(trimmedUpvotes));
                }
            }
            if (!hasViewed) {
                await incrementViews(postId);
            }
        } catch (error) {
            setPostErrorMessage(error.response.data?.message || 'Error voting');
            setTimeout(() => setPostErrorMessage(""), 3000);
        }
    };

	const replyRemoved = (replyId) => {
		if (!isAuthenticated) return;
		setReplies((prevReplies) => prevReplies.filter((r) => r?.post_id !== replyId));
	};
  
	const savePost = async () => {
		if (!isAuthenticated) return;
        try {
            if (isSaved) {
                await api.delete('/remove_saved_post', {
                    data: {
                        channelId: post?.parentChannel?.channel_id,
                        feedId: viewer?.feed_id,
                        postId: post?.post_id
                    }
                });
            } else {
                await api.post('/save_post', {
                    channelId: post?.parentChannel?.channel_id,
                    feedId: viewer?.feed_id,
                    postId: post?.post_id
                });
            }
            setIsSaved(!isSaved);
			onSaveToggle?.(post?.post_id, !isSaved);
			setTimeout(() => setPostErrorMessage(""), 3000);
        } catch (error) {
            setPostErrorMessage(error.response.data?.message || 'Error saving post');
			setTimeout(() => setPostErrorMessage(""), 3000);
        }
    };

	useEffect(() => {
		if (isAuthenticated && (isViewingOwnPost || feed?.isAdmin || feed?.isModerator) && !canRemoveState) {
			setCanRemoveState(true);
		}
	}, [isViewingOwnPost, feed?.isAdmin, feed?.isModerator, canRemoveState, isAuthenticated]);

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

	const handleContentHeightChange = (height) => {
		setContentHeight(height);
	};

	const handleOverflowChange = (overflowing) => {
		setIsOverflowing(overflowing);
		setShowExpandButton(overflowing);
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

	return (
		<><div className={`content-item ${isReply ? 'reply' : ''}`}>
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
						: { height: 'auto', overflow: 'visible' })
				}}
			>
				<div ref={contentContainerRef} style={{ position: 'relative' }}>
					<div className="display-div" style={isFullscreenMode ? { flex: 1, overflowY: 'auto' } : {}}>
						<ContentDisplay 
							post={post} 
							onCodeAppChange={setHasCodeOrApp} 
							onOverflowChange={handleOverflowChange} 
							showFullContent={showFullContent} 
							showScrollBar={false}
							onHeightChange={handleContentHeightChange}
						/>
					</div>
					{showExpandButton && !isFullscreenMode && (
						<button
							className="small-icon"
							onClick={(e) => {
								e.stopPropagation();
								setShowFullContent(!showFullContent);
								if (!showFullContent && contentContainerRef.current) {
									contentContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
								}
							}}
							title={showFullContent ? 'Show less' : 'Show more'}
						>
							{showFullContent ? <FaChevronUp /> : <FaChevronDown />}
						</button>
					)}
				</div>
				<div className="content-footer" style={{ justifyContent: 'flex-end' }}>
					{(fullscreenRef.current?.requestFullscreen || fullscreenRef.current?.webkitRequestFullscreen) && hasCodeOrApp && (
						<button className="large-icon" onClick={toggleFullscreen} title={isFullscreenMode ? "Close full-screen" : "Full-screen"}>
							{isFullscreenMode ? <FaCompress /> : <FaExpand />}
						</button>
					)}
				</div>
			</div>
			{showNote && <div className="ask-note"><p className="ask-note-text">{note}</p></div>}
			<div className="content-metadata">
				{!isDraft && (<div className="feed-info">
					<Link className="feed-link" onClick={() => incrementViews(post?.post_id)} to={display ? '/welcome' : `/u/${post?.poster?.feed_name}`}>
						<img className="small-feed-photo" src={`${post?.poster?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
						<p className="feed-list-text">{post?.poster?.feed_name ?? 'Anonymous'}</p>
					</Link>
				</div>)}
				{!isDraft && !display && <Link to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`} onClick={() => incrementViews(post?.post_id)}>
					<p className="small-text feed-channel-link faded-text">{feedName}/{channelName}</p>
				</Link>}
				{!isDraft && (<div className="vote-container" style={{ marginRight: `${display && 0}` }}>
					{(isAuthenticated || display) ? (
						!isViewingOwnPost ? (
							<div className="post-button-group">
								<button className={`large-icon ${hasUpvoted ? 'vote-active vote-disabled' : 'vote-enabled'}`} onClick={() => postVote(post?.post_id, 'upvote')} title={hasUpvoted ? 'Remove upvote' : 'Upvote'}>
									<FaArrowUp />
								</button>
								<p className="small-text">{FormatNumber(upvotes - downvotes)}</p>
								<button className={`large-icon ${hasDownvoted ? 'vote-active vote-disabled' : 'vote-enabled'}`} onClick={() => postVote(post?.post_id, 'downvote')} title={hasDownvoted ? 'Remove downvote' : 'Downvote'}>
									<FaArrowDown />
								</button>
							</div>
						) : (
							<p className="small-text">{FormatNumber(upvotes - downvotes)} {Math.abs(upvotes - downvotes) === 1 ? 'vote' : 'votes'}</p>
						)
					) : (
						<div className="post-button-group">
							<button className="large-icon" onClick={handleLoginRedirect} style={{ padding: 0 }} title="Login to vote">
								<FaArrowUp />
							</button>
							<p className="small-text" style={{ margin: 0 }}>{FormatNumber(upvotes - downvotes)}</p>
							<button className="large-icon" onClick={handleLoginRedirect} style={{ padding: 0 }} title="Login to vote">
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
						<button className="large-icon" onClick={deleteClick} title={isReply ? "Delete Reply" : isDraft ? "Delete draft" : "Delete Post"}>
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
					{isAuthenticated && !feed?.is_locked && (
						<div>
							<button
								className="large-icon"
								disabled={readOnly}
								onClick={() => navigate(`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}/reply`)}
								title="Reply"
							>
								<FaReply /><p className="icon-text">Reply</p>
							</button>
						</div>
					)}
					{treeViewMode ? (
						<ReplyTreeView
							replies={replies}
							renderReplyContent={renderReplyContent} />
					) : (
						replies.length !== 0 ? (
							replies.map((reply) => (
								<ContentWidget
									canRemove={canRemoveState}
									feed={feed}
									key={reply?.post_id}
									onPostRemoved={replyRemoved}
									post={reply}
									readOnly={readOnly} />
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
		<ConfirmModal isOpen={showDeleteConfirm} onConfirm={confirmDelete} onCancel={cancelDelete} title={`Delete ${pendingDeleteAction}`} message={`Are you sure you want to delete this ${pendingDeleteAction}?`} /></>
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