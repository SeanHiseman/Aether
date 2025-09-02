import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import FeedItem from './feedItem';

const DeepFeedItem = ({ deepFeed, onFeedAdded, showHeader }) => {
	const [contents, setContents] = useState([]);
	const [errorMessage, setErrorMessage] = useState('');
	const [isExpanded, setIsExpanded] = useState(false);
	const [loading, setLoading] = useState(false);

	const { setNodeRef, isOver } = useDroppable({
		id: deepFeed.deep_feed_id.toString(), 
		data: { 
			type: 'deepFeed',
			deepFeedId: deepFeed.deep_feed_id,
			isDeepFeed: true 
		}
	});

	const fetchContents = async () => {
		if (contents.length > 0) return;
		setLoading(true);
		try {
			const { data } = await axios.get(`/api/deep_feed_contents/${deepFeed.deep_feed_id}`);
			setContents(data.contents || []);
		} catch (error) {
			setErrorMessage(error.response?.data?.message || 'Failed to load deep feed contents.');
			setContents([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!showHeader) setIsExpanded(true);
	}, [showHeader]);

	useEffect(() => {
		if (!isExpanded) return;
		if (deepFeed.feeds && contents.length === 0) setContents(deepFeed.feeds);
	}, [deepFeed.feeds, isExpanded, contents.length]);

	useEffect(() => {
		if (onFeedAdded) onFeedAdded(deepFeed.deep_feed_id, handleAddFeed);
		return () => {
			if (onFeedAdded) onFeedAdded(deepFeed.deep_feed_id, null);
		};
	}, [deepFeed.deep_feed_id, onFeedAdded]);

	const handleAddFeed = useCallback((feed) => {
		try {
			if (feed.type === 'UPDATE_CONTENTS') {
				fetchContents();
				return;
			}
			setContents(prev => {
				if (prev.some(item => item.feed && item.feed.feed_id === feed.feed_id)) return prev;
				return [...prev, {
					feed: {
						feed_id: feed.feed_id,
						feed_name: feed.feed_name,
						feed_photo: feed.feed_photo,
						is_group: feed.is_group
					}
				}];
			});
		} catch (error) {
			setErrorMessage('Failed to add feed to deep feed.');
			setTimeout(() => setErrorMessage(''), 5000);
		}
	}, []);

	const handleExpand = useCallback((e) => {
		e.stopPropagation();
		if (!showHeader) return;
		if (!isExpanded) fetchContents();
		setIsExpanded(prev => !prev);
	}, [isExpanded, showHeader]);

	return (
		<div ref={setNodeRef} className={`deep-feed-container ${isOver ? 'drop-target-active' : ''}`} data-deep-feed-id={deepFeed.deep_feed_id}>
			{showHeader && (
				<div className="channel-link deep-feed-header">
					<Link to={`/d/${deepFeed.deep_feed_id}`}>
						<p style={{ margin: '0' }}>{deepFeed.name}</p>
					</Link>
					<div onClick={handleExpand}>
						{isExpanded ? <FaChevronUp /> : <FaChevronDown />}
					</div>
					{errorMessage && <div className="error-message">{errorMessage}</div>}
				</div>
			)}
			{isExpanded && (
				<div className="feed-list deep-feed-content">
					{loading ? (
						<p className="text16">Loading...</p>
					) : (
						<SortableContext 
							items={contents.filter(item => item.feed).map(item => 
								`df-${deepFeed.deep_feed_id}-feed-${item.feed.feed_id}`
							)} 
							strategy={verticalListSortingStrategy}
						>
							{contents.map(item => (
								<FeedItem 
									key={item.feed.feed_id} 
									id={item.feed.feed_id.toString()} 
									feed={item.feed} 
									isChat={false} 
									parentDeepFeedId={deepFeed.deep_feed_id} 
								/>
							))}
						</SortableContext>
					)}
				</div>
			)}
		</div>
	);
};

export default DeepFeedItem;