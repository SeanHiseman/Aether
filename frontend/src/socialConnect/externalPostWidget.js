import api from '../api';
import { AuthContext } from '../components/authContext';
import ContentDisplay from '../components/content/contentDisplay';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaComments, FaHeart, FaRegBookmark, FaShare } from 'react-icons/fa';
import { FormatNumber } from '../functions/formatNumber';
import ShareExternalPostModal from '../components/modals/shareExternalPostModal';
import { useParams } from 'react-router-dom';
import { useContext, useEffect, useRef, useState } from 'react';
import useTimeAgo from '../functions/useTimeAgo';

const ExternalPostWidget = ({ post, sharedPost = false }) => {
	console.log("ExternalPostWidget post:", post);
	const authContext = useContext(AuthContext);
	const { isAuthenticated = false } = authContext || {};
	const { post_id } = useParams();
	const [isLoaded, setIsLoaded] = useState(false);
	const isLike = post?.source === 'Bluesky' || post?.source === 'Mastodon';
	const isVote = post?.source === 'Reddit';
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [showExpandButton, setShowExpandButton] = useState(false);
	const [showFullContent, setShowFullContent] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [userVote, setUserVote] = useState(() => {
		if (post?.has_upvoted) return post.source === 'Reddit' ? 'upvote' : 'like';
		if (post?.has_downvoted) return 'downvote';
		return null;
	});
	const [localScore, setLocalScore] = useState(post?.score || 0);
	const [voteError, setVoteError] = useState('');
	const timeAgo = useTimeAgo(post?.created_at);
	const contentContainerRef = useRef(null);

	const handleOverflowChange = (overflowing) => {
		setIsOverflowing(overflowing);
		setShowExpandButton(overflowing);
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

	const handleVote = async (voteType) => {
		if (!isAuthenticated) {
			setVoteError('Please log in to vote');
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

	return (
		<div className={'content-item'}>
			{post?.title && <a href={post?.url} target="_blank" rel="noopener noreferrer" className="title-container" style={{ display: 'block' }}>
				<span className="large-text" style={{ marginLeft: 0 }}>
					{post?.title || '\u00A0'}
				</span>
			</a>}
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
				<div className="vote-container" style={{ marginRight: `${sharedPost && 0}` }}>
					{sharedPost ? (
						<div className="post-button-group">
							{isVote && (
								<>
									<p className="small-text compact">{FormatNumber(localScore)}</p>
								</>
							)}
							{isLike && (
								<>
									<p className="small-text compact">{FormatNumber(localScore)} {isLike && 'likes'}</p>
								</>
							)}
						</div>
					) : (
						<div className="post-button-group">
							{isVote && (
								<>
									<button
										className="large-icon compact"
										style={{
											backgroundColor: 'transparent',
											pointerEvents: 'auto',
											color: userVote === 'upvote' ? '#ff4500' : undefined
										}}
										onClick={() => handleVote('upvote')}
										title="Upvote"
									>
										<FaArrowUp />
									</button>
									<p className="small-text compact">{FormatNumber(localScore)}</p>
									<button
										className="large-icon compact"
										style={{
											backgroundColor: 'transparent',
											pointerEvents: 'auto',
											color: userVote === 'downvote' ? '#7193ff' : undefined
										}}
										onClick={() => handleVote('downvote')}
										title="Downvote"
									>
										<FaArrowDown />
									</button>
								</>
							)}
							{isLike && (
								<>
									<button
										className="large-icon compact"
										style={{
											backgroundColor: 'transparent',
											pointerEvents: 'auto',
											color: userVote === 'like' ? '#ff1744' : undefined
										}}
										onClick={() => handleVote('like')}
										title="Like"
									>
										<FaHeart />
									</button>
									<p className="small-text compact">{FormatNumber(localScore)}</p>
								</>
							)}
						</div>
					)}
					{voteError && <p className="tiny-text" style={{ color: '#ff1744' }}>{voteError}</p>}
				</div>
				{!sharedPost && (
					<div className="post-button-group reply-buttons">
						<a href={post?.url} className="large-icon compact" title={"Replies"} rel="noopener noreferrer" target="_blank">
							<FaComments />
							<p className="small-text compact">{post?.replies}</p>
						</a>
					</div>
				)}
				{!sharedPost && isAuthenticated && (
					<div className="post-button-group">
						<button className="large-icon compact" title="Share post" onClick={() => setShowShareModal(true)}>
							<FaShare />
						</button>
					</div>
				)}
				<a href={post?.url} target="_blank" rel="noopener noreferrer">
					<p className="small-text compact feed-channel-link faded-text">See post at {sourceLabel}</p>
				</a>
				<div className="view-date-container">
					<p className="small-text compact faded-text" style={{ margin: '0px', textAlign: 'right' }}>
						{post_id ? new Date(post?.created_at).toLocaleDateString() : timeAgo}
					</p>
				</div>
			</div>
			{showShareModal && <ShareExternalPostModal post={post} onClose={() => setShowShareModal(false)} />}
		</div>
	);
};

export default ExternalPostWidget;