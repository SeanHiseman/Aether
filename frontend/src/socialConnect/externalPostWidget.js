import { AuthContext } from '../components/authContext';
import ContentDisplay from '../components/content/contentDisplay';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaComments, FaHeart, FaRegBookmark, FaShare } from 'react-icons/fa';
import { FormatNumber } from '../functions/formatNumber';
import ShareExternalPostModal from '../components/modals/shareExternalPostModal';
import { useParams } from 'react-router-dom';
import { useContext, useEffect, useRef, useState } from 'react';
import useTimeAgo from '../functions/useTimeAgo';

const ExternalPostWidget = ({ post, sharedPost = false }) => {
	//console.log("ExternalPostWidget post:", post);
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
		} else {
			timeoutId = setTimeout(() => setIsLoaded(true), 5000);
		}
		return () => clearTimeout(timeoutId);
	}, [post]);

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
									<p className="small-text compact">{FormatNumber(post?.score)}</p>
								</>
							)}
							{isLike && (
								<>
									<p className="small-text compact">{FormatNumber(post?.score)} {isLike && 'likes'}</p>
								</>
							)}
						</div>
					) : (
						<div className="post-button-group">
							{isVote && (
								<>
									<button className="large-icon compact" style={{ backgroundColor: 'transparent', pointerEvents: 'auto' }}>
										<FaArrowUp />
									</button>
									<p className="small-text compact">{FormatNumber(post?.score)}</p>
									<button className="large-icon compact" style={{ backgroundColor: 'transparent', pointerEvents: 'auto' }}>
										<FaArrowDown />
									</button>
								</>
							)}
							{isLike && (
								<>
									<button className="large-icon compact" style={{ backgroundColor: 'transparent', pointerEvents: 'auto' }}>
										<FaHeart />
									</button>
									<p className="small-text compact">{FormatNumber(post?.score)}</p>
								</>
							)}
						</div>
					)}
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