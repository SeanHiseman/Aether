import axios from 'axios';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaComments, FaCommentSlash, FaEdit, FaReply, FaTrash, FaTree, FaListUl } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../authContext';
import AskButton from '../askButton';
import ContentDisplay from './contentDisplay';
import ReplyTreeView from './replyTreeView';
import PropTypes from 'prop-types';

const ContentWidget = ({ canRemove, feed, isDraft, isGroup, onEditClick, onPostRemoved, onReplyClick, parent, post, readOnly = false }) => {
	const [canRemoveState, setCanRemoveState] = useState(canRemove);
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
	const [treeViewMode, setTreeViewMode] = useState(false);
	const [upvoteLimit, setUpvoteLimit] = useState(false);
	const [upvotes, setUpvotes] = useState(post.upvotes);
	const [views, setViews] = useState(post.views);
	const { isAuthenticated, viewer, user } = useContext(AuthContext);
    const channelName = post.parentChannel.channel_name;
    const feedName = post.parentChannel.feed?.feed_name;
	const isReply = readOnly ? false : post.parent_id !== null; //Read only means not displaying widget as a reply
	const isViewingOwnPost = post.poster_id === viewer?.feed_id;
	const urlPrefix = (isGroup || post.parentChannel.feed?.is_group) ? 'g' : 'u';

	const getReplies = useCallback(async (postId) => {
		try {
			const response = await axios.get(`/api/post_replies/${postId}`);
			const processedReplies = response.data.map(reply => ({
				...reply,
				showSubReplies: false,
				subReplies: []
			}));
			setReplies(processedReplies);
		} catch {
			setPostErrorMessage('Error getting replies');
		}
	}, []);

	const incrementViews = useCallback(
		async (postId) => {
			if (!isAuthenticated) return; //Only count views if user is logged in
			try {
				if (!hasViewed && (!isAuthenticated || (isAuthenticated && viewer?.feed_id !== post.poster_id))) {
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
		[hasViewed, post.poster_id, viewer?.feed_id]
	);

	const postVote = async (postId, voteType) => {
		if (!isAuthenticated) return;
		try {
			const response = await axios.post('/api/content_vote', {
				postId: postId,
				feedId: viewer.feed_id,
				voteType,
			});
			if (response.data.success) {
				setUpvotes(response.data.upvotes);
				setDownvotes(response.data.downvotes);
				setUpvoteLimit(response.data.reachedUpvoteLimit);
				setDownvoteLimit(response.data.reachedDownvoteLimit);
			} else {
				if (response.data.message === 'upvote limit') {
					setUpvoteLimit(true);
				} else if (response.data.message === 'downvote limit') {
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
						draft_id: post.draft_id
					}
				};
			} else {
				url = "/api/remove_post";
				dataPayload = {
					post: {
						post_id: post.post_id,
						...(post.parent_id != null && { parent_id: post.parent_id })
					}
				};
			}
			const response = await axios.delete(url, { data: dataPayload });
			if (response.data.success) {
				onPostRemoved(isDraft ? post.draft_id : post.post_id)
				if (!isDraft) {
					navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
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
		setReplies((prevReplies) => prevReplies.filter((r) => r.post_id !== replyId));
	};

	const handleLoginRedirect = () => {
		if (window.confirm ('Login to vote.')) {
			navigate('/login', { state: {from: window.location.pathname} });
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
					postId: post.post_id,
					feedId: viewer?.feed_id,
					voteType: 'check_vote',
				});
				if (response.data.success) {
					setUpvoteLimit(response.data.reachedUpvoteLimit);
					setDownvoteLimit(response.data.reachedDownvoteLimit);
				}
			} catch (error) { 
				setPostErrorMessage('Error checking vote limit');
			}
		};
		checkVoteLimit();
	}, [isAuthenticated, post.post_id, viewer?.feed_id]);

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
					<Link className="feed-link" to={`/u/${reply.poster.feed_name}`}>
						<img className="small-feed-photo" src={`/${reply.poster.feed_photo}`} alt="Feed" />
						<p className="feed-list-text">{reply.poster.feed_name}</p>
					</Link>
				</div>
				<ContentDisplay 
					content={reply.content} 
					showFullContent={false} 
					showScrollBar={false}
					treeViewMode={true}
				/>
				<div className="tree-reply-footer">
					<span className="total-votes">{reply.upvotes - reply.downvotes} votes</span>
					<button className="small-icon" onClick={() => onReplyClick(reply)} title="Reply">
						<FaReply />
					</button>
					{reply.replies > 0 && (
						<span className="reply-count">{reply.replies} {reply.replies === 1 ? 'reply' : 'replies'}</span>
					)}
				</div>
			</div>
		);
	};

	const downvoteClass = downvoteLimit ? 'vote-disabled' : 'vote-enabled';
	const upvoteClass = upvoteLimit ? 'vote-disabled' : 'vote-enabled';

	return (
		<div className={`content-item ${isReply ? 'reply' : ''}`}>
			{postErrorMessage && <div className="error-message">{postErrorMessage}</div>}
			<Link
				className="title-container"
				onClick={() => incrementViews(post.post_id)}
				style={{ display: 'block' }}
				to={`/${urlPrefix}/${feed.feed_name}/${post.parentChannel?.channel_name}/${post.post_id}`}
			>
				<span className="text36" style={{ marginLeft: 0 }}>
					{post.title || '\u00A0'}
				</span>
			</Link>

			<ContentDisplay content={post.content} onOverflowChange={handleOverflowChange} showFullContent={showFullContent} showScrollBar={false} />
			{isOverflowing && (
				<button className="small-icon" onClick={() => setShowFullContent(!showFullContent)} title={showFullContent ? 'Show less' : 'Show more'}>
					{showFullContent ? <FaChevronUp /> : <FaChevronDown />}
				</button>
			)}
			{showNote && <div className="ask-note"><p className="ask-note-text">{note}</p></div>}
			<div className="content-metadata">
				{!isDraft && (<div className="feed-info">
					<Link className="feed-link" onClick={() => incrementViews(post.post_id)} to={`/u/${post.poster?.feed_name}`}>
						<img className="small-feed-photo" src={`/${post.poster?.feed_photo}`} alt={'/media/site_images/blank-profile.png'} />
						<p className="feed-list-text">{post.poster?.feed_name ?? 'Anonymous'}</p>
					</Link>
				</div>)}
                <Link to={`/${urlPrefix}/${feedName}/${channelName}`}>
                    <p className="text16 clickable">{feedName}/{channelName}</p>
                </Link>
				{!isDraft && (<div className="vote-container">
					{isAuthenticated ? (
						!isViewingOwnPost ? (   
							<>
								<button className={`large-icon ${upvoteClass}`} disabled={upvoteLimit} onClick={() => postVote(post.post_id, 'upvote')} title={upvoteLimit ? (user.has_membership ? 'Vote limit reached' : 'Get membership for more votes') : 'Upvote'}>
									<FaArrowUp />
								</button>
								<span className="total-votes">{upvotes - downvotes}</span>      
								<button className={`large-icon ${downvoteClass}`} disabled={downvoteLimit} onClick={() => postVote(post.post_id, 'downvote')} title={downvoteLimit ? (user.has_membership ? 'Vote limit reached' : 'Get membership for more votes') : 'Downvote'}>
									<FaArrowDown />
								</button>
							</>
						) : (
							<span className="total-votes">{upvotes - downvotes} {Math.abs(upvotes - downvotes) === 1 ? 'vote' : 'votes'}</span>
						)
					) : (
						<>
							<button className="large-icon" onClick={handleLoginRedirect} title="Login to vote">
								<FaArrowUp />
							</button>
							<span className="total-votes">{upvotes - downvotes}</span>
							<button className="large-icon" onClick={handleLoginRedirect} title="Login to vote">
								<FaArrowDown />
							</button>
						</>
					)}
				</div>)}
				{!readOnly && !isDraft && (
					<>
						<button className="large-icon" data-content-id={post.post_id} onClick={toggleReplies} title={showReplies ? "Close Replies" : "Show Replies"}>
							{showReplies ? <FaCommentSlash /> : <FaComments />}
							<p className="text16" id={`reply-count-${post.post_id}`}>{post.replies}</p>
						</button>
						{/*{showReplies && post.replies > 0 && (
							<button className="large-icon" onClick={toggleViewMode} title={treeViewMode ? "Switch to List View" : "Switch to Tree View"}>
								{treeViewMode ? <FaListUl /> : <FaTree />}
							</button>
						)}*/}
						{isAuthenticated && !feed.is_locked && (
							<button className="large-icon" onClick={() => onReplyClick(post)} disabled={readOnly} title="Reply">
								<FaReply />
							</button>
						)}
					</>
				)}
				{!isDraft && (<p className="text16">{views} {views === 1 ? 'view' : 'views'}</p>)}
				<p className="text16" style={{margin: '0px'}}>{new Date(post.created_at).toLocaleDateString()}</p>
				{isAuthenticated && post.poster_id === viewer.feed_id && !readOnly && (
					<button className="large-icon" onClick={() => onEditClick(post)} title={isReply ? "Edit Reply" : isDraft ? "Edit draft" : "Edit Post"}>
						<FaEdit />
					</button>
				)}
				{isAuthenticated && canRemoveState && !readOnly && (
					<button className="large-icon" onClick={removePost} title={isReply ? "Delete Reply" : isDraft ? "Delete draft" : "Delete Post"}>
						<FaTrash />
					</button>
				)}
				{/*{isAuthenticated && !post.note?.is_misinfo && !isDraft && (
					<AskButton content={post} isGroup={isGroup} isReply={false} note={note} setNote={setNote} setPostErrorMessage={setPostErrorMessage} setShowNote={setShowNote} showNote={showNote} />
				)}*/}
			</div>
			{showReplies && (
				<div className="reply-section">
					{treeViewMode ? (
						<ReplyTreeView 
							replies={replies} 
							onReplyClick={onReplyClick}
							renderReplyContent={renderReplyContent}
						/>
					) : (
						replies.length !== 0 ? (
							replies.map((reply) => (
								<ContentWidget 
									canRemove={canRemoveState} 
									feed={feed} 
									isGroup={isGroup} 
									key={reply.post_id} 
									onEditClick={onEditClick} 
									onPostRemoved={replyRemoved} 
									onReplyClick={onReplyClick} 
									post={reply} 
									readOnly={readOnly} 
								/>
							))
						) : (
							<p className="text24">No replies</p>
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
	isGroup: PropTypes.bool.isRequired,
	onEditClick: PropTypes.func.isRequired,
	onPostRemoved: PropTypes.func.isRequired,
	onReplyClick: PropTypes.func.isRequired, 
	parent: PropTypes.object,
	post: PropTypes.object.isRequired,
	readOnly: PropTypes.bool, 
};

export default ContentWidget;
