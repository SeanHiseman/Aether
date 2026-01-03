import api from '../../api';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ContentWidget from '../../components/content/contentWidget';
import { FaPlus } from 'react-icons/fa';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import SwipeableAside from '../../components/swipeableAside';
import { useCallback, useContext, useEffect, useState, useRef } from 'react';
import { v4 } from 'uuid';
const FETCH_LIMIT = 50;

//Currently awaiting implementation of saved channels
const SavedPosts = () => {
	const { channel_name } = useParams();
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const [channels, setChannels] = useState([]);
	const [posts, setPosts] = useState([]);
	const [savedError, setSavedError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [offset, setOffset] = useState(0);
	const navigate = useNavigate();
	const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 
	const scrollRef = useRef(null);

	const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

	const fetchPosts = useCallback(async (reset = false) => {
		setIsLoading(true);
		setSavedError('');
		try {
			const currentOffset = reset ? 0 : offset;
			const response = await api.get('/get_saved_posts', {
				params: {
					limit: FETCH_LIMIT,
					offset: currentOffset
				}
			});
			const newPosts = response.data?.posts || [];
			setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
			setOffset(reset ? FETCH_LIMIT : offset + FETCH_LIMIT);
			setHasMore(newPosts.length === FETCH_LIMIT);
		} catch (error) {
			setSavedError(error.response?.data?.message || 'Error loading posts');
		} finally {
			setIsLoading(false);
		}
	}, [offset]);

	const loadMore = useCallback(() => {
		if (!isAuthenticated || isLoading || !hasMore) return;
		fetchPosts(false);
	}, [isAuthenticated, isLoading, hasMore, fetchPosts]);

	useEffect(() => {
		if (!isAuthenticated) return;
		fetchPosts(true);
	}, [isAuthenticated]); 
	
	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
			loadMore();
		}
	}, [loadMore]);

	const addChannel = async () => {
		try {
			const name = `New channel ${channels.length + 1}`;
			const { data } = await api.post('/add_feed_channel', {
				channelName: name,
				isSaved: true
			});
			setChannels([data.newChannel, ...channels]);
			navigate(`/saved/${name}`);
		} catch (error) {
			setSavedError(error.response.data?.message || 'Error creating channel');
		}
	};

	const saveToggle = (postId, isSaved) => {
		try {
			if (!isSaved) {
				setPosts(prev => prev.filter(p => p?.post_id !== postId));
			}
		} catch (error) {
			setSavedError(error.response.data?.message || "Error toggling");
		}
	};

	const currentChannel = channels.find(c => c?.channel_name === channel_name);

	return (
		<div className="standard-container">
			<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
				{posts.length > 0 ? (
					<>
						<ul className="content-list">
							{posts.map((post) => (
								<ContentWidget
									canRemove={false}
									feed={post.parentChannel?.feed}
									isDraft={false}
									isGroup={false}
									key={post.post_id}
									onEditClick={() => {}}
									onPostRemoved={() => {}}
									onReplyClick={() => {}}
									onSaveToggle={saveToggle}
									post={post}
								/>
							))}
						</ul>
						{isLoading && <p className="large-text faded-text">Loading more posts...</p>}
					</>
				) : (
					!isLoading && <p className="large-text faded-text">No posts yet</p>
				)}
				{/*})}*/}
				{/*{!currentChannel && <p className="large-text">Choose a channel</p>}*/}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
				<p className="large-text">Saved posts</p>
				{/*<button className="small-icon" onClick={addChannel} title="New channel">
					<FaPlus />
				</button>*/}
				{/*<ChannelList
					canReorder={true}
					channels={channels}
					feedId="saved"
					feedName="saved"
					isChat={false}
					isGroup={false}
					isSaved={true}
					setChannels={setChannels}
				/>*/}
				<div className="error-message">{savedError}</div>
			</SwipeableAside>
		</div>
	);
};

export default SavedPosts;