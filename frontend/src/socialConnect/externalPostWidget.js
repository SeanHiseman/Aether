import { AuthContext } from '../components/authContext';
import ContentDisplay from '../components/content/contentDisplay';
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaComments, FaHeart, FaRegBookmark } from 'react-icons/fa';
import { FormatNumber } from '../functions/formatNumber';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useContext, useEffect, useRef, useState } from 'react';
import useTimeAgo from '../functions/useTimeAgo';

const ExternalPostWidget = ({ post }) => {
    console.log("external post:", post);
	const authContext = useContext(AuthContext);
	const { isAuthenticated = false } = authContext || {};
	const { post_id } = useParams();
	const [isLoaded, setIsLoaded] = useState(false);
	const isLike = post?.source === 'Bluesky' || post?.source === 'Mastodon';
	const isVote = post?.source === 'Reddit';
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [showExpandButton, setShowExpandButton] = useState(false);
	const [showFullContent, setShowFullContent] = useState(false);
	const timeAgo = useTimeAgo(post?.created_at);
	const contentContainerRef = useRef(null);

	const handleOverflowChange = (overflowing) => {
		setIsOverflowing(overflowing);
		setShowExpandButton(overflowing);
	};

	function normaliseRedditAvatar(url) {
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
    if (!isAuthenticated) {
        return <p className="small-text faded-text">Please log in to view this content.</p>;
    }

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
						<img className="small-feed-photo" src={normaliseRedditAvatar(post?.poster?.user_photo)} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
						<p className="feed-list-text">{post?.poster?.username ?? 'Anonymous'}</p>
					</a>
				</div>
				<div className="vote-container" style={{ marginRight: 0 }}>
					<div className="post-button-group">
						{isVote && (
							<>
								<button className="large-icon">
									<FaArrowUp />
								</button>
								<p className="small-text">{FormatNumber(post?.score)}</p>
								<button className="large-icon">
									<FaArrowDown />
								</button>
							</>
						)}
						{isLike && (
							<>
								<button className="large-icon">
									<FaHeart />
								</button>
								<p className="small-text">{FormatNumber(post?.score)}</p>
							</>
						)}
					</div>
				</div>
				<div className="post-button-group reply-buttons">
					<a href={post?.url} className="large-icon" title={"Replies"}>
						<FaComments />
						<p className="small-text">{post?.replies}</p>
					</a>
				</div>
				<div className="button-text-bottom">
					<button className="large-icon">
						<FaRegBookmark />
					</button>
				</div>
				<a href={post?.url} target="_blank" rel="noopener noreferrer">
					<p className="small-text feed-channel-link faded-text">View post at: {post?.channel || 'Unknown source'} on {post?.source || 'Unknown site'}</p>
				</a>
				<div className="view-date-container">
					<p className="small-text faded-text" style={{ margin: '0px', textAlign: 'right' }}>
						{post_id ? new Date(post?.created_at).toLocaleDateString() : timeAgo}
					</p>
				</div>
			</div>
		</div>
	);
};

ExternalPostWidget.propTypes = {
	post: PropTypes.object.isRequired,
};

export default ExternalPostWidget;