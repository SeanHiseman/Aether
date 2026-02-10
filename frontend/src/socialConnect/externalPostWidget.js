import api from '../api';
import { AuthContext } from '../components/authContext';
import ContentDisplay from '../components/content/contentDisplay';
import { FaArrowDown, FaArrowUp, FaBookmark, FaChevronDown, FaChevronUp, FaComments, FaHeart, FaQuoteRight, FaRegBookmark, FaRetweet, FaShare } from 'react-icons/fa';
import { FormatNumber } from '../functions/formatNumber';
import QuotePostModal from '../components/modals/quotePostModal';
import RecommendationInfo from '../components/recommendationInfo';
import SaveToChannelModal from '../components/modals/saveToChannelModal';
import SharePostModal from '../components/modals/sharePostModal';
import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import useTimeAgo from '../functions/useTimeAgo';

const ExternalPostWidget = ({ post, sharedPost = false, isQuoted = false, showAsParent = false }) => {
	//console.log("ExternalPostWidget post:", post);
	const authContext = useContext(AuthContext);
	const { isAuthenticated = false } = authContext || {};
	const { post_id } = useParams();
	const navigate = useNavigate();
	const [isLoaded, setIsLoaded] = useState(false);
	const isLike = post?.source === 'Bluesky' || post?.source === 'Mastodon';
	const isVote = post?.source === 'Reddit';
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [isSaved, setIsSaved] = useState(post?.is_saved || false);
	const [showExpandButton, setShowExpandButton] = useState(false);
	const [showFullContent, setShowFullContent] = useState(false);
	const [showSaveModal, setShowSaveModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [showQuoteModal, setShowQuoteModal] = useState(false);
	const [replies, setReplies] = useState([]);
	const [showReplies, setShowReplies] = useState(showAsParent ? false : (post_id ? (post?.replies > 0) : false));
	const [loadingReplies, setLoadingReplies] = useState(false);
	const [userVote, setUserVote] = useState(() => {
		if (post?.has_upvoted) return post.source === 'Reddit' ? 'upvote' : 'like';
		if (post?.has_downvoted) return 'downvote';
		return null;
	});
	const [localScore, setLocalScore] = useState(post?.score || 0);
	const [voteError, setVoteError] = useState('');
	const [hasReposted, setHasReposted] = useState(post?.has_reposted || false);
	const [repostCount, setRepostCount] = useState(post?.repost_count || 0);
	const timeAgo = useTimeAgo(post?.created_at);
	const contentContainerRef = useRef(null);

	//Check if user has this platform connected
	const connectedAccounts = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
	const platformName = post?.source?.toLowerCase(); //Convert 'Bluesky' -> 'bluesky'
	const hasConnectedPlatform = connectedAccounts.some(a => a.platform === platformName);

	const handleOverflowChange = useCallback((overflowing) => {
		setIsOverflowing(overflowing);
		setShowExpandButton(overflowing);
	}, []);

	const fetchReplies = async () => {
		if (!post?.post_id || replies.length > 0) return;
		try {
			setLoadingReplies(true);
			const encodedPostId = encodeURIComponent(post.post_id);
			const response = await api.get(`/external_post_replies/${encodedPostId}`);
			if (response.data?.success && response.data?.replies) {
				setReplies(response.data.replies);
			}
		} catch (error) {
			console.error('Error fetching replies:', error);
		} finally {
			setLoadingReplies(false);
		}
	};

	const toggleReplies = () => {
		const newShowReplies = !showReplies;
		setShowReplies(newShowReplies);
		if (newShowReplies && replies.length === 0) {
			fetchReplies();
		}
	};

	function normaliseAvatar(url) {
		if (!url) return '';
		let out = url.replace(/&amp;/g, '&');
		if (out.startsWith('//')) out = 'https:' + out;
		return out;
	}

	useEffect(() => {
		let timeoutId;
		if (post) {
			setIsLoaded(true);
			setLocalScore(post?.score || 0);
			setIsSaved(post?.is_saved || false);
		} else {
			timeoutId = setTimeout(() => setIsLoaded(true), 5000);
		}
		return () => clearTimeout(timeoutId);
	}, [post]);

	useEffect(() => {
		//Use vote data from post object if available
		if (post?.has_upvoted !== undefined) {
			if (post.has_upvoted) {
				setUserVote(post.source === 'Reddit' ? 'upvote' : 'like');
			} else if (post.has_downvoted) {
				setUserVote('downvote');
			} else {
				setUserVote(null);
			}
			return;
		}
	}, [isAuthenticated, post?.post_id, post?.has_upvoted, post?.has_downvoted, post?.source]);

	//Auto-fetch replies when showReplies becomes true and no replies are loaded
	useEffect(() => {
		if (showReplies && replies.length === 0 && !loadingReplies) {
			fetchReplies();
		}
	}, [showReplies]);

	const handleVote = async (voteType) => {
		if (!isAuthenticated) {
			setVoteError('Please log in to vote');
			setTimeout(() => setVoteError(''), 3000);
			return;
		}
		if (!hasConnectedPlatform) {
			setVoteError(`Please connect your ${post.source} account to vote`);
			setTimeout(() => setVoteError(''), 3000);
			return;
		}
		const prevVote = userVote;
		const prevScore = localScore;
		try {
			setVoteError('');
			//Optimistic update
			if (userVote === voteType) {
				//Removing vote
				setUserVote(null);
				if (isVote) {
					setLocalScore(prev => prev - (voteType === 'upvote' ? 1 : -1));
				} else {
					setLocalScore(prev => prev - 1);
				}
			} else {
				//Adding or changing vote
				setUserVote(voteType);
				if (isVote) {
					let delta = voteType === 'upvote' ? 1 : -1;
					if (prevVote) {
						delta = voteType === 'upvote' ? 2 : -2;
					}
					setLocalScore(prev => prev + delta);
				} else {
					setLocalScore(prev => prev + (prevVote ? 0 : 1));
				}
			}
			const response = await api.post('/vote_external_post', {
				postId: post.post_id,
				voteType,
				source: post.source,
				sourcePostId: post.source_post_id
			});
			if (!response.data.success) {
				//Revert on failure
				setUserVote(prevVote);
				setLocalScore(prevScore);
				setVoteError(response.data.message || 'Failed to record vote');
				setTimeout(() => setVoteError(''), 3000);
			} else {
				//Success - update to match actual vote type returned
				setUserVote(response.data.voteType);
				if (!response.data.syncedToPlatform) {
					setVoteError('Vote saved locally but not synced to platform');
					setTimeout(() => setVoteError(''), 3000);
				}
			}
		} catch (error) {
			console.error('Error voting:', error);
			//Revert on error
			setUserVote(prevVote);
			setLocalScore(prevScore);
			setVoteError('Error recording vote');
			setTimeout(() => setVoteError(''), 3000);
		}
	};

	const toggleRepost = async () => {
		if (!isAuthenticated) {
			setVoteError('Please log in to repost');
			setTimeout(() => setVoteError(''), 3000);
			return;
		}
		try {
			const response = await api.post('/toggle_repost', {
				postId: post.post_id,
				feedId: authContext.viewer?.feed_id,
				isExternal: true
			});
			if (response.data?.success) {
				setHasReposted(response.data?.reposted);
				setRepostCount(response.data?.repost_count);
			}
		} catch (error) {
			setVoteError('Error reposting');
			setTimeout(() => setVoteError(''), 3000);
		}
	};

	const handleSaveComplete = (saved) => {
		setIsSaved(saved);
	};

	const handleBookmarkClick = async () => {
		if (isSaved) {
			//Unsave directly by sending empty channelIds
			try {
				const response = await api.post('/save_post_to_channels', {
					postId: post.post_id,
					channelIds: [],
					isExternal: true
				});
				if (response.data?.success) {
					setIsSaved(false);
				}
			} catch (error) {
				console.error('Error unsaving post:', error);
			}
		} else {
			//Show modal to select channels
			setShowSaveModal(true);
		}
	};

	const handlePostClick = (e) => {
		//Don't navigate if clicking on interactive elements
		if (
			e.target.tagName === 'BUTTON' ||
			e.target.tagName === 'A' ||
			e.target.closest('button') ||
			e.target.closest('a') ||
			e.target.closest('.large-icon') ||
			e.target.closest('.small-icon') ||
			sharedPost ||
			isQuoted ||
			post_id //Already on single post page
		) {
			return;
		}
		//Navigate to internal post page
		if (post?.source && post?.post_id) {
			navigate(`/${post.source.toLowerCase()}/${encodeURIComponent(post.post_id)}`);
		}
	};

	if (!isLoaded) {
		return <p className="small-text faded-text">Loading content…</p>;
	}

	//Special formatting for subreddits, regular otherwise
	const subreddit = post?.source === 'Reddit' && post?.channel
		? post.channel.replace(/^r\//i, '')
		: null;
	const sourceLabel = post?.source === 'Reddit' && subreddit
		? `r/${subreddit} on Reddit`
		: (post?.source || 'Unknown site');

	const isReply = showAsParent ? false : post?.parent_id !== null;

	return (
		<div
			className={`content-item ${isReply ? 'reply' : ''}`}
			onClick={handlePostClick}
			style={{
				...(isQuoted ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {}),
				...(showAsParent ? { borderBottomRightRadius: 0 } : {}),
				cursor: (!sharedPost && !isQuoted && !post_id) ? 'pointer' : 'default'
			}}
		>
			{post?.title && <a href={post?.url} target="_blank" rel="noopener noreferrer" className="title-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				<span className="large-text" style={{ marginLeft: 0 }}>
					{post?.title || '\u00A0'}
				</span>
				{post?.recommendationReasons && <RecommendationInfo reasons={post.recommendationReasons} />}
			</a>}
			{!post?.title && post?.recommendationReasons && (
				<div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0' }}>
					<RecommendationInfo reasons={post.recommendationReasons} />
				</div>
			)}
			<div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', height: 'auto', overflow: 'visible' }}>
				<div style={{ position: 'relative', flex: 'initial', display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
					<div ref={contentContainerRef} className="display-div">
						<ContentDisplay post={post} redirect={false} onOverflowChange={handleOverflowChange} showFullContent={showFullContent} showScrollBar={!showExpandButton || showFullContent} />
					</div>
					<div className="content-footer" style={{ justifyContent: showExpandButton ? 'space-between' : 'flex-end' }}>
						{showExpandButton && (
							<button
								className="small-icon"
								onClick={(e) => {
									e.stopPropagation();
									setShowFullContent(!showFullContent);
									if (!showFullContent && contentContainerRef.current) {
										contentContainerRef.current.scrollIntoView({
											behavior: 'smooth',
											block: 'start'
										});
									}
								}}
								title={showFullContent ? 'Show less' : 'Show more'}
							>
								{showFullContent ? <FaChevronUp /> : <FaChevronDown />}
							</button>
						)}
					</div>
				</div>
			</div>
			<div className="content-metadata">
				<div className="feed-info">
					<a className="feed-link" target="_blank" rel="noopener noreferrer" href={post?.poster?.profile_url}>
						<img className="medium-feed-photo" src={normaliseAvatar(post?.poster?.user_photo)} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
						<p className="feed-list-text">{post?.poster?.username ?? 'Anonymous'}</p>
					</a>
				</div>
				<a className="external-link" href={post?.url} target="_blank" rel="noopener noreferrer">
					<p className="small-text feed-channel-link faded-text">See post at {sourceLabel}</p>
				</a>
				{!sharedPost ? (
					<div className="vote-container">
						<div className="post-button-group">
							{isVote && (
								<>
									<button
										className="large-icon"
										style={{
											backgroundColor: 'transparent',
											pointerEvents: 'auto',
											color: userVote === 'upvote' ? '#ff4500' : undefined,
											opacity: !isAuthenticated || !hasConnectedPlatform ? 0.5 : 1,
											cursor: !isAuthenticated || !hasConnectedPlatform ? 'not-allowed' : 'pointer'
										}}
										onClick={() => handleVote('upvote')}
										title={!hasConnectedPlatform ? `Connect ${post.source} to upvote` : "Upvote"}
										disabled={!isAuthenticated || !hasConnectedPlatform}
									>
										<FaArrowUp />
									</button>
									<p className="small-text">{FormatNumber(localScore)}</p>
									<button
										className="large-icon"
										style={{
											backgroundColor: 'transparent',
											pointerEvents: 'auto',
											color: userVote === 'downvote' ? '#7193ff' : undefined,
											opacity: !isAuthenticated || !hasConnectedPlatform ? 0.5 : 1,
											cursor: !isAuthenticated || !hasConnectedPlatform ? 'not-allowed' : 'pointer'
										}}
										onClick={() => handleVote('downvote')}
										title={!hasConnectedPlatform ? `Connect ${post.source} to downvote` : "Downvote"}
										disabled={!isAuthenticated || !hasConnectedPlatform}
									>
										<FaArrowDown />
									</button>
								</>
							)}
							{isLike && (
								<>
									<button
										className="large-icon"
										style={{
											backgroundColor: 'transparent',
											pointerEvents: 'auto',
											color: userVote === 'like' ? '#ff1744' : undefined,
											opacity: !isAuthenticated || !hasConnectedPlatform ? 0.5 : 1,
											cursor: !isAuthenticated || !hasConnectedPlatform ? 'not-allowed' : 'pointer'
										}}
										onClick={() => handleVote('like')}
										title={!hasConnectedPlatform ? `Connect ${post.source} to like` : "Like"}
										disabled={!isAuthenticated || !hasConnectedPlatform}
									>
										<FaHeart />
									</button>
									<p className="small-text">{FormatNumber(localScore)}</p>
								</>
							)}
						</div>
						{voteError && <p className="tiny-text" style={{ color: '#ff1744' }}>{voteError}</p>}
					</div>
				) : (
					<div className="vote-container">
						<div className="post-button-group">
							{isVote && (
								<p className="small-text">{FormatNumber(localScore)}</p>
							)}
							{isLike && (
								<p className="small-text">{FormatNumber(localScore)} {isLike && 'likes'}</p>
							)}
						</div>
					</div>
				)}
				{!sharedPost && (
					<div className="post-button-group reply-buttons">
						<button
							className="large-icon"
							title={showReplies ? "Hide replies" : "Show replies"}
							onClick={toggleReplies}
							style={{ cursor: 'pointer' }}
						>
							<FaComments />
							<p className="small-text">{post?.replies || 0}</p>
						</button>
					</div>
				)}
				{!sharedPost && isAuthenticated && (
					<div className="post-button-group save-share-buttons">
						<button className="large-icon" title={isSaved ? 'Unsave post' : 'Save post'} onClick={handleBookmarkClick}>
							{isSaved ? <FaBookmark /> : <FaRegBookmark />}
						</button>
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
						<button className="large-icon" title="Quote post" onClick={() => setShowQuoteModal(true)}>
							<FaQuoteRight />
						</button>
						<button className="large-icon" title="Share post" onClick={() => setShowShareModal(true)}>
							<FaShare />
						</button>
					</div>
				)}
				<div className="date-container">
					<p className="small-text faded-text" style={{ margin: '0px', textAlign: 'right' }}>
						{post_id ? new Date(post?.created_at).toLocaleDateString() : timeAgo}
					</p>
				</div>
			</div>
			{showSaveModal && <SaveToChannelModal post={post} isExternal={true} onClose={() => setShowSaveModal(false)} onSaveComplete={handleSaveComplete} />}
			{showShareModal && <SharePostModal post={post} isExternal={true} onClose={() => setShowShareModal(false)} />}
			{showQuoteModal && <QuotePostModal externalPost={post} onClose={() => setShowQuoteModal(false)} />}
			{showReplies && !isQuoted && !sharedPost && (
				<div className="reply-section">
					{loadingReplies ? (
						<p className="small-text faded-text">Loading replies...</p>
					) : replies.length > 0 ? (
						<>
							{replies.map((reply) => (
								<ExternalPostWidget
									key={reply.post_id}
									post={reply}
									showAsParent={showAsParent}
								/>
							))}
							<div className="replies-footer">
								<button className="small-icon" onClick={toggleReplies} title="Close Replies">
									<FaChevronUp />
								</button>
							</div>
						</>
					) : (
						<p className="small-text faded-text">
							{!isAuthenticated
								? 'Log in to see replies'
								: !hasConnectedPlatform
									? `Connect your ${post?.source} account to see replies`
									: 'No replies'}
						</p>
					)}
				</div>
			)}
		</div>
	);
};

export default ExternalPostWidget;
