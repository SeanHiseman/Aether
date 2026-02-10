import api from '../../api';
import AskButton from '../askButton';
import { AuthContext } from '../authContext';
import ContentDisplay from './contentDisplay';
import ConfirmModal from '../modals/confirmModal';
import { FaArrowDown, FaArrowUp, FaBookmark, FaChevronDown, FaChevronUp, FaComments, FaCommentSlash, FaEdit, FaEllipsisV, FaCompress, FaExpand, FaQuoteRight, FaRegBookmark, FaReply, FaRetweet, FaShare, FaTrash, FaTree, FaListUl } from 'react-icons/fa';
import { FormatNumber } from '../../functions/formatNumber';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import LoginModal from '../modals/loginModal';
import MembershipModal from '../modals/membershipModal';
import RecommendationInfo from '../recommendationInfo';
import ReplyTreeView from './replyTreeView';
import QuotePostModal from '../modals/quotePostModal';
import SaveToChannelModal from '../modals/saveToChannelModal';
import SharePostModal from '../modals/sharePostModal';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import useTimeAgo from '../../functions/useTimeAgo';

const ContentWidget = ({ canRemove = false, display = false, feed, isDraft = false, isQuoted = false, onPostRemoved, parent, post, showAsParent = false, sharedPost = false }) => {
	//console.log("ContentWidget post:", post);
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
	const [hasReposted, setHasReposted] = useState(post?.has_reposted || false);
	const [repostCount, setRepostCount] = useState(post?.repost_count || 0);
	const [hasViewed, setHasViewed] = useState(false);
	const [isFullscreenMode, setIsFullscreenMode] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
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
	const [showLoginModal, setShowLoginModal] = useState(false);
	const [showNote, setShowNote] = useState(post?.note && post?.note?.is_misinfo);
	const [showReplies, setShowReplies] = useState(showAsParent ? false : (post_id ? (post?.replies > 0) : false));
	const [showSaveModal, setShowSaveModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [showQuoteModal, setShowQuoteModal] = useState(false);
	const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
	const [treeViewMode, setTreeViewMode] = useState(false);
	const dropdownRef = useRef(null);
	const [upvotes, setUpvotes] = useState(post?.upvotes);
	const [views, setViews] = useState(post?.views);
    const channelName = post?.parentChannel?.channel_name;
    const feedName = post?.parentChannel?.feed?.feed_name;
	const isReply = showAsParent ? false : post?.parent_id !== null; //Read only means not displaying widget as a reply
	const isViewingOwnPost = post?.poster_id === viewer?.feed_id;
	const timeAgo = useTimeAgo(post?.created_at);
	const urlPrefix = (post?.parentChannel?.feed?.is_group) ? 'g' : 'u';
	const contentContainerRef = useRef(null);
	const hasMembership = user?.has_membership;

	//Sync local state with prop changes
	useEffect(() => {
		if (post) {
			setUpvotes(post.upvotes);
			setDownvotes(post.downvotes);
			setHasUpvoted(post.has_upvoted || false);
			setHasDownvoted(post.has_downvoted || false);
			setIsSaved(post.is_saved);
			setViews(post.views);
			setHasReposted(post.has_reposted || false);
			setRepostCount(post.repost_count || 0);
		}
	}, [post]);

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
				onPostRemoved(isDraft ? post?.draft_id : post?.post_id);
				if (!isDraft && !location.pathname.startsWith('/search')) {
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
			setPostErrorMessage(error.response?.data?.message || `Error removing ${pendingDeleteAction}`);
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
			setPostErrorMessage(error.response?.data?.message || 'Error getting replies');
			setTimeout(() => setPostErrorMessage(""), 3000);
		}
	}, []);

	const handleLoginRedirect = () => {
		setShowLoginModal(true);
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
				setPostErrorMessage(error.response?.data?.message || 'Error incrementing views');
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
				setUpvotes(response.data.upvotes);
				setDownvotes(response.data.downvotes);
				setHasUpvoted(response.data.hasUpvoted);
				setHasDownvoted(response.data.hasDownvoted);
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
            setPostErrorMessage(error.response?.data?.message || 'Error voting');
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
				if (!hasViewed) {
					await incrementViews(post?.post_id);
				}
            }
            setIsSaved(!isSaved);
			setTimeout(() => setPostErrorMessage(""), 3000);
        } catch (error) {
            setPostErrorMessage(error.response?.data?.message || 'Error saving post');
			setTimeout(() => setPostErrorMessage(""), 3000);
        }
    };

	const toggleRepost = async () => {
		if (!isAuthenticated) {
			setPostErrorMessage('Please log in to repost');
			setTimeout(() => setPostErrorMessage(""), 3000);
			return;
		}
		try {
			await incrementViews(post?.post_id);
			const response = await api.post('/toggle_repost', {
				postId: post?.post_id,
				feedId: viewer?.feed_id,
				isExternal: false
			});
			if (response.data?.success) {
				setHasReposted(response.data?.reposted);
				setRepostCount(response.data?.repost_count);
			}
		} catch (error) {
			setPostErrorMessage(error.response?.data?.message || 'Error reposting');
			setTimeout(() => setPostErrorMessage(""), 3000);
		}
	};

	const handleBookmarkClick = async () => {
		await incrementViews(post?.post_id);
		if (isSaved) {
			//Unsave directly by sending empty channelIds
			try {
				const response = await api.post('/save_post_to_channels', {
					postId: post.post_id,
					channelIds: [],
					isExternal: false,
					feedId: viewer?.feed_id,
					channelId: post.parentChannel?.channel_id || post.channel_id
				});
				if (response.data?.success) {
					setIsSaved(false);
				}
			} catch (error) {
				setPostErrorMessage(error.response?.data?.message || 'Error unsaving post');
				setTimeout(() => setPostErrorMessage(""), 3000);
			}
		} else {
			//Show modal to select channels
			setShowSaveModal(true);
		}
	};

	useEffect(() => {
		let timeoutId;
		if (post) {
			setIsLoaded(true);
		} else {
			timeoutId = setTimeout(() => setIsLoaded(true), 5000);
		}
		return () => clearTimeout(timeoutId);
	}, [post]);

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

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setShowOptionsDropdown(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

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
						<img className="medium-feed-photo" src={`/${reply?.poster?.feed_photo}`} alt="Feed" />
						<p className="feed-list-text">{reply?.poster?.feed_name}</p>
					</Link>
				</div>
				<ContentDisplay content={reply?.content} onCodeAppChange={setHasCodeOrApp} showFullContent={false} showScrollBar={false} />
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

	if (!isLoaded) {
		return <p className="small-text faded-text">Loading content…</p>;
	}

	return (
		<><div className={`content-item ${isReply ? 'reply' : ''}`} style={{
			...(showAsParent ? { borderBottomRightRadius: 0 } : {}),
			...(isQuoted ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {})
		}}>
			{postErrorMessage && <div className="small-text faded-text">{postErrorMessage}</div>}
			{post?.title && (
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Link to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`} className="title-container" onClick={() => incrementViews(post?.post_id)} style={{ display: 'block', flex: 1 }}>
						<span className="large-text" style={{ marginLeft: 0 }}>
							{post?.title || '\u00A0'}
						</span>
					</Link>
					{post?.recommendationReasons && <RecommendationInfo reasons={post.recommendationReasons} />}
				</div>
			)}
			{!post?.title && post?.recommendationReasons && (
				<div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0' }}>
					<RecommendationInfo reasons={post.recommendationReasons} />
				</div>
			)}
			<div ref={fullscreenRef}
				onClick={() => incrementViews(post?.post_id)}
				style={{
					position: 'relative',
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					...(isFullscreenMode
						? { height: '100vh', overflow: 'hidden' }
						: { height: 'auto', overflow: 'visible' })
				}}
			>
				<div ref={contentContainerRef} style={{ 
					position: 'relative',
					flex: isFullscreenMode ? 1 : 'initial',
					display: 'flex',
					flexDirection: 'column',
					overflow: isFullscreenMode ? 'hidden' : 'visible'
				}}>
					<div className="display-div" style={isFullscreenMode ? { 
						flex: 1, 
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden'
					} : {}}>
						<ContentDisplay
							post={post}
							isFullscreen={isFullscreenMode}
							onCodeAppChange={setHasCodeOrApp}
							onOverflowChange={handleOverflowChange}
							showFullContent={showFullContent || isFullscreenMode}
							showScrollBar={!showExpandButton || showFullContent || isFullscreenMode}
							onHeightChange={handleContentHeightChange}
						/>
					</div>
				</div>
				<div className="content-footer" style={{ justifyContent: (showExpandButton && !isFullscreenMode) ? 'space-between' : 'flex-end' }}>
					{showExpandButton && !isFullscreenMode && (
						<button
							className="small-icon"
							onClick={(e) => {
								e.stopPropagation();
								setShowFullContent(!showFullContent);
								if (!showFullContent && contentContainerRef.current) {
									contentContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
								};
								incrementViews(post?.post_id);
							}}
						>
							{showFullContent ? <FaChevronUp /> : <FaChevronDown />}
							<p className="icon-text">{showFullContent ? 'Show less' : 'Show more'}</p>
						</button>
					)}
					{(fullscreenRef.current?.requestFullscreen || fullscreenRef.current?.webkitRequestFullscreen) && hasCodeOrApp && (
						<button className="large-icon" onClick={toggleFullscreen} title={isFullscreenMode ? "Close full-screen" : "Full-screen"}>
							{isFullscreenMode ? <FaCompress /> : <FaExpand />}
						</button>
					)}
				</div>
			</div>
			{showNote && <div className="ask-note"><p className="ask-note-text">{note}</p></div>}
			<div className="content-metadata">
				{!isDraft && (
					<div className="feed-info">
						<Link className="feed-link" onClick={() => incrementViews(post?.post_id)} to={display ? '/welcome' : `/u/${post?.poster?.feed_name}`}>
							<img className="medium-feed-photo" src={`${post?.poster?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
							<p className="feed-list-text">{post?.poster?.feed_name ?? 'Anonymous'}</p>
						</Link>
					</div>
				)}
				{!isDraft && !display && (
					<Link to={`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`} onClick={() => incrementViews(post?.post_id)}>
						<p className="small-text feed-channel-link faded-text">{feedName}/{channelName}</p>
					</Link>
				)}
				{!isDraft && (
					<div className="vote-container" style={{ marginRight: `${display && 0}` }}>
						{sharedPost ? (
							<p className="small-text">{FormatNumber(upvotes - downvotes)} {Math.abs(upvotes - downvotes) === 1 ? 'vote' : 'votes'}</p>
						) : (isAuthenticated || display) ? (
							!isViewingOwnPost ? (
								<div className="post-button-group">
									<button className={`large-icon ${hasUpvoted ? 'vote-disabled' : 'vote-enabled'}`} onClick={() => postVote(post?.post_id, 'upvote')} title={hasUpvoted ? 'Remove upvote' : 'Upvote'}>
										<FaArrowUp />
									</button>
									<p className="small-text">{FormatNumber(upvotes - downvotes)}</p>
									<button className={`large-icon ${hasDownvoted ? 'vote-disabled' : 'vote-enabled'}`} onClick={() => postVote(post?.post_id, 'downvote')} title={hasDownvoted ? 'Remove downvote' : 'Downvote'}>
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
					</div>
				)}
				{!isDraft && !display && !sharedPost && (
					<div className="post-button-group reply-buttons">
						<button className="large-icon" data-content-id={post?.post_id} onClick={toggleReplies} title={showReplies ? "Close Replies" : "Show Replies"}>
							{showReplies ? <FaCommentSlash /> : <FaComments />}
							<p className="small-text" id={`reply-count-${post?.post_id}`}>{post?.replies}</p>
						</button>
					</div>
				)}
				{!sharedPost && isAuthenticated && (post?.poster_id === viewer?.feed_id || canRemoveState) && !showAsParent && (
					<div className="post-button-group options-buttons" style={{ position: 'relative', zIndex: showOptionsDropdown ? 1001 : 'auto' }} ref={dropdownRef}>
						<button className="large-icon" onClick={() => setShowOptionsDropdown(!showOptionsDropdown)} title="Options">
							<FaEllipsisV />
						</button>
						{showOptionsDropdown && (
							<div className="dropdown-menu dropdown-above">
								{post?.poster_id === viewer?.feed_id && (
									<button
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											width: '100%',
											padding: '12px 16px',
											border: 'none',
											background: 'none',
											color: 'var(--lightest)',
											cursor: 'pointer',
											fontSize: '14px',
											textAlign: 'left'
										}}
										onClick={() => {
											setShowOptionsDropdown(false);
											navigate(
												isDraft
													? `/${urlPrefix}/${feed_name}/${channel_name}/${post?.draft_id}/edit`
													: `/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}/edit`,
												{ state: { editData: post, isDraft: isDraft, parentPost: parent } }
											);
										}}
										onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
										onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
									>
										<FaEdit /> {isReply ? "Edit Reply" : isDraft ? "Edit draft" : "Edit Post"}
									</button>
								)}
								{canRemoveState && (
									<button
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											width: '100%',
											padding: '12px 16px',
											border: 'none',
											background: 'none',
											color: '#ff4444',
											cursor: 'pointer',
											fontSize: '14px',
											textAlign: 'left',
											borderTop: post?.poster_id === viewer?.feed_id ? '1px solid var(--border)' : 'none'
										}}
										onClick={() => {
											setShowOptionsDropdown(false);
											deleteClick();
										}}
										onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
										onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
									>
										<FaTrash /> {isReply ? "Delete Reply" : isDraft ? "Delete draft" : "Delete Post"}
									</button>
								)}
							</div>
						)}
					</div>
				)}
				{!sharedPost && !isDraft && isAuthenticated && (
					<div className="post-button-group save-share-buttons">
						<button className="large-icon" title={isSaved ? 'Unsave post' : 'Save post'} onClick={handleBookmarkClick}>
							{isSaved ? <FaBookmark /> : <FaRegBookmark />}
						</button>
						{!display && (
							<button
								className="large-icon"
								style={{
									color: hasReposted ? '#17bf63' : undefined
								}}
								title={hasReposted ? 'Remove repost' : 'Repost'}
								onClick={toggleRepost}
							>
								<FaRetweet />
							</button>
						)}
						{!post?.is_private && (
							<button className="large-icon" title="Quote post" onClick={async () => { await incrementViews(post?.post_id); setShowQuoteModal(true); }}>
								<FaQuoteRight />
							</button>
						)}
						{!post?.is_private && (
							<button className="large-icon" title="Share post" onClick={async () => { await incrementViews(post?.post_id); setShowShareModal(true); }}>
								<FaShare />
							</button>
						)}
					</div>
				)}
				{!isDraft && (
					<div className="views-container">
						<p className="small-text faded-text" style={{ margin: '0px', textAlign: 'right' }}>
							{FormatNumber(views)} {views === 1 ? 'view' : 'views'}
						</p>
					</div>
				)}
				{!display && (
					<div className="date-container">
						<p className="small-text faded-text" style={{ margin: '0px', textAlign: 'right' }}>
							{post_id ? new Date(post?.created_at).toLocaleDateString() : timeAgo}
						</p>
					</div>
				)}
			</div>
			{!isReplyMode && showReplies && (
				<div className="reply-section">
					{isAuthenticated && !feed?.is_locked && (
						<div>
							<button
								className="large-icon"
								disabled={showAsParent}
								onClick={() => navigate(
									`/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}/reply`,
									{ state: { replyingTo: post } } 
								)}
								title="Reply"
							>
								<FaReply /><p className="icon-text">Reply</p>
							</button>
						</div>
					)}
					{treeViewMode ? (
						<ReplyTreeView replies={replies} renderReplyContent={renderReplyContent} />
					) : (
						replies.length !== 0 ? (
							replies.map((reply) => (
								<ContentWidget
									canRemove={canRemoveState}
									feed={feed}
									key={reply?.post_id}
									onPostRemoved={replyRemoved}
									parent={post}
									post={reply}
									showAsParent={showAsParent} />
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
		<ConfirmModal isOpen={showDeleteConfirm} onConfirm={confirmDelete} onCancel={cancelDelete} title={`Delete ${pendingDeleteAction}`} message={`Are you sure you want to delete this ${pendingDeleteAction}?`} />
		<LoginModal
			isOpen={showLoginModal}
			onClose={() => setShowLoginModal(false)}
			message="Please log in to vote on posts."
			title="Login Required"
		/>
		{showQuoteModal && <QuotePostModal post={post} onClose={() => setShowQuoteModal(false)} />}
		{showSaveModal && <SaveToChannelModal post={post} isExternal={false} onClose={() => setShowSaveModal(false)} onSaveComplete={(saved) => { setIsSaved(saved); }} />}
		{showShareModal && <SharePostModal post={post} isExternal={false} onClose={() => setShowShareModal(false)} />}
		</>
	);
};

export default ContentWidget;