import api from '../../api';
import { useCallback, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';
import FeedItem from './feedItem';

const DeepFeedItem = ({ deepFeed, onFeedAdded, showHeader }) => {
	const [contents, setContents] = useState([]);
	const [errorMessage, setErrorMessage] = useState('');
	const [isExpanded, setIsExpanded] = useState(false);
	const [loading, setLoading] = useState(false);
	const location = useLocation();

	const { setNodeRef, isOver } = useDroppable({
		id: `df-${deepFeed?.deep_feed_id}`,
		data: { 
			type: 'deepFeed',
			deepFeedId: deepFeed?.deep_feed_id,
			isDeepFeed: true 
		}
	});

	const addFeed = useCallback((feed) => {
		try {
			if (feed.type === 'UPDATE_CONTENTS') {
				fetchContents(true);
				return;
			}
			setContents(prev => {
				if (prev.some(item => item?.feed && item?.feed?.feed_id === feed?.feed_id)) return prev;
				const updated = [...prev, {
					feed: {
						feed_id: feed?.feed_id,
						feed_name: feed?.feed_name,
						feed_photo: feed?.feed_photo,
						is_group: feed?.is_group
					}
				}];
				localStorage.setItem(
					`deepFeedContents_${deepFeed?.deep_feed_id}`,
					JSON.stringify(updated)
				);
				return updated;
			});
		} catch (error) {
			setErrorMessage(error.response.data?.message || 'Failed to add feed to deep feed.');
			setTimeout(() => setErrorMessage(''), 5000);
		}
	}, [deepFeed?.deep_feed_id]);

	const fetchContents = async (forceRefresh = false) => {
		if (contents.length > 0 && !forceRefresh) return;
		const cached = localStorage.getItem(`deepFeedContents_${deepFeed?.deep_feed_id}`);
		if (cached && !forceRefresh) {
			setContents(JSON.parse(cached));
			return;
		}
		setLoading(true);
		try {
			//If loading for the first time
			const { data } = await api.get(`/deep_feed_contents/${deepFeed?.deep_feed_id}`);
			setContents(data?.contents || []);
			localStorage.setItem(
				`deepFeedContents_${deepFeed?.deep_feed_id}`,
				JSON.stringify(data?.contents || [])
			);
		} catch (error) {
			setErrorMessage(error.response.data?.message || 'Failed to load deep feed contents.');
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
		if (deepFeed?.feeds && contents.length === 0) setContents(deepFeed?.feeds);
	}, [deepFeed?.feeds, isExpanded, contents.length]);

	useEffect(() => {
		if (onFeedAdded) onFeedAdded(deepFeed?.deep_feed_id, addFeed);
		return () => {
			if (onFeedAdded) onFeedAdded(deepFeed?.deep_feed_id, null);
		};
	}, [deepFeed?.deep_feed_id, onFeedAdded, addFeed]);

	useEffect(() => {
		const handleUpdate = (event) => {
			if (event.detail.deepFeedId === deepFeed?.deep_feed_id) {
				fetchContents(true);
			}
		};
		window.addEventListener('deepFeedUpdated', handleUpdate);
		return () => window.removeEventListener('deepFeedUpdated', handleUpdate);
	}, [deepFeed?.deep_feed_id]);

	const handleExpand = useCallback((e) => {
		e.stopPropagation();
		if (!showHeader) return;
		if (!isExpanded) fetchContents();
		setIsExpanded(prev => !prev);
	}, [isExpanded, showHeader, fetchContents]);

	return (
		<div ref={setNodeRef} className={`deep-feed-container ${isOver ? 'drop-target-active' : ''}`} data-deep-feed-id={deepFeed?.deep_feed_id}>
			{showHeader && (
				<div className={`channel-link deep-feed-header ${location.pathname.startsWith(`/d/${deepFeed?.deep_feed_id}`) ? 'selected' : ''}`}>
					<Link to={`/d/${deepFeed?.deep_feed_id}`} title={`Go to ${deepFeed?.deep_feed_name}`}>
						<p style={{ margin: '0' }}>{deepFeed?.name}</p>
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
						<p className="small-text faded-text">Loading...</p>
					) : (
						contents.map(item => (
							<FeedItem 
								key={item?.feed?.feed_id} 
								id={item?.feed?.feed_id.toString()} 
								feed={item?.feed} 
								isChat={false} 
								parentDeepFeedId={deepFeed?.deep_feed_id} 
							/>
						))
					)}
				</div>
			)}
		</div>
	);
};

export default DeepFeedItem;