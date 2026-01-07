import AlgorithmSelector from '../algorithms/algorithmSelector';
import api from '../api';
import { AuthContext } from '../components/authContext';
import { ChunkFeeds } from '../functions/chunkFeeds';
import ContentWidget from '../components/content/contentWidget';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import FeedWidget from '../components/content/feedWidget';
import SwipeableAside from '../components/swipeableAside';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
const FETCH_LIMIT = 100;

const SearchResults = () => {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [feedPage, setFeedPage] = useState(0);
	const [feeds, setFeeds] = useState([]);
	const [feedTypeFilter, setFeedTypeFilter] = useState('all');
	const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
	const [hasMorePosts, setHasMorePosts] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [postPage, setPostPage] = useState(0);
	const [posts, setPosts] = useState([]);
	const [selectedView, setSelectedView] = useState('combined');
	const [searchParams] = useSearchParams();
	const keyword = (searchParams.get('keyword') || '').trim();
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const shownPostIdsRef = useRef([]);
	const shownFeedIdsRef = useRef([]);
	const scrollRef = useRef(null);

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");
	
	const fetchPosts = useCallback(async (page = 0) => {
		try {
			setIsLoading(true);
			const recentUpvotes = JSON.parse(localStorage.getItem('recentUpvotes') || '[]');
			const response = await api.post('/search', {
				keyword,
				limit: FETCH_LIMIT,
				feedOffset: 0,
				postOffset: page * FETCH_LIMIT,
				recentUpvotes
			});
			const { message, posts: newPosts, success } = response.data || {};
			if (!success) {
				setErrorMessage(message || 'Failed to fetch posts');
				setHasMorePosts(false);
				return;
			}
			if (!newPosts || newPosts.length === 0) {
				if (page === 0) {
					setPosts([]);
					shownPostIdsRef.current = [];
					setErrorMessage(message || '');
				}
				setHasMorePosts(false);
				return;
			}
			if (page === 0) {
				setPosts(newPosts);
				shownPostIdsRef.current = newPosts.map(p => p?.post_id);
			} else {
				setPosts(prev => [...prev, ...newPosts]);
				const newIds = newPosts.map(p => p?.post_id);
				shownPostIdsRef.current = [...shownPostIdsRef.current, ...newIds];
			}
		} catch (error) {
			setErrorMessage(error.response?.data?.message || 'Failed to fetch posts');
			setHasMorePosts(false);
		} finally {
			setIsLoading(false);
		}
	}, [keyword]);

	const fetchFeeds = useCallback(async (page = 0) => {
		try {
			const recentUpvotes = JSON.parse(localStorage.getItem('recentUpvotes') || '[]');
			const response = await api.post('/search', {
				keyword,
				limit: 60, //3 feeds for every 5 posts
				feedOffset: page * 60,
				postOffset: 0,
				recentUpvotes
			});
			let newFeeds = response.data?.feeds || [];
			if (feedTypeFilter !== 'all') {
				newFeeds = newFeeds.filter(feed => (feedTypeFilter === 'group' ? feed.is_group : !feed.is_group));
			}
			if (newFeeds.length === 0) {
				setHasMoreFeeds(false);
				return;
			}
			if (page === 0) {
				setFeeds(newFeeds);
				const newIds = newFeeds.map(f => f?.feed_id);
				shownFeedIdsRef.current = newIds;
			} else {
				setFeeds(prev => [...prev, ...newFeeds]);
				const newIds = newFeeds.map(f => f?.feed_id);
				shownFeedIdsRef.current = [...shownFeedIdsRef.current, ...newIds];
			}
		} catch (error) {
			setErrorMessage(error.response?.data?.message || 'Failed to fetch feeds');
			setHasMoreFeeds(false);
		}
	}, [keyword, feedTypeFilter]);

	const loadMore = useCallback(async () => {
		if (isLoading) return;
		if (selectedView === 'combined') {
			if (!hasMorePosts && !hasMoreFeeds) return;
			setIsLoading(true);
			const nextPostPage = postPage + 1;
			const nextFeedPage = feedPage + 1;
			if (hasMorePosts) await fetchPosts(nextPostPage);
			if (hasMoreFeeds) await fetchFeeds(nextFeedPage);
			if (hasMorePosts) setPostPage(nextPostPage);
			if (hasMoreFeeds) setFeedPage(nextFeedPage);
			setIsLoading(false);
		} else if (selectedView === 'posts' && hasMorePosts) {
			setIsLoading(true);
			const nextPostPage = postPage + 1;
			await fetchPosts(nextPostPage);
			setPostPage(nextPostPage);
			setIsLoading(false);
		} else if (selectedView === 'feeds' && hasMoreFeeds) {
			setIsLoading(true);
			const nextFeedPage = feedPage + 1;
			await fetchFeeds(nextFeedPage);
			setFeedPage(nextFeedPage);
			setIsLoading(false);
		}
	}, [isLoading, selectedView, fetchPosts, fetchFeeds, postPage, feedPage, hasMorePosts, hasMoreFeeds]);
	
	const handlePostRemoved = (removedId) => {
		setPosts(prev => prev.filter(p => p.post_id !== removedId));
	};

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element || isLoading) return;
		const threshold = window.innerHeight * 1.5; //1.5vh from the bottom
		if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
			loadMore();
		}
	}, [loadMore, isLoading]);

	const combinedItems = useMemo(() => {
		if (selectedView !== 'combined') return [];
		const feedTriplets = ChunkFeeds(feeds, 3).map(f => ({ type: 'feedTriplet', data: f }));
		const postItems = posts.map(p => ({ type: 'post', data: p }));
		const interspersed = [];
		const POSTS_PER_BLOCK = 5;
		let postIndex = 0;
		let feedIndex = 0;
		while (postIndex < postItems.length || feedIndex < feedTriplets.length) {
			for (let i = 0; i < POSTS_PER_BLOCK && postIndex < postItems.length; i++) {
				interspersed.push(postItems[postIndex]);
				postIndex++;
			}
			if (feedIndex < feedTriplets.length) {
				interspersed.push(feedTriplets[feedIndex]);
				feedIndex++;
			}
		}
		return interspersed;
	}, [selectedView, posts, feeds]);

	const dropdownToggle = (e) => {
		e.stopPropagation();
		setDropdownOpen(prev => !prev);
	};

	const refreshPosts = () => {
		setErrorMessage('');
		setRefreshTrigger(prev => prev + 1);
	};

	useEffect(() => {
		if (!keyword) return;
		setIsLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]);
		setPosts([]);
		shownPostIdsRef.current = [];
		shownFeedIdsRef.current = [];
		const fetches = [];
		if (selectedView === 'combined' || selectedView === 'posts') fetches.push(fetchPosts(0));
		if (selectedView === 'combined' || selectedView === 'feeds') fetches.push(fetchFeeds(0));
		Promise.all(fetches).then(() => setIsLoading(false));
	}, [selectedView, fetchPosts, fetchFeeds, keyword, feedTypeFilter]);

	useEffect(() => {
		if (!refreshTrigger || !keyword) return;
		setIsLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]);
		setPosts([]);
		shownPostIdsRef.current = [];
		shownFeedIdsRef.current = [];
		const fetches = [];
		if (selectedView === 'combined' || selectedView === 'posts') fetches.push(fetchPosts(0));
		if (selectedView === 'combined' || selectedView === 'feeds') fetches.push(fetchFeeds(0));
		Promise.all(fetches).then(() => setIsLoading(false));
	}, [refreshTrigger, fetchPosts, fetchFeeds, selectedView, keyword, feedTypeFilter]);

	const isInitialLoad = isLoading && posts.length === 0 && feeds.length === 0;

	document.title = 'Search';
	return (
		<div className="standard-container">
			<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
				{isInitialLoad ? (
					<div className="flex justify-center items-center h-64">
						<span className="text-xl faded-text">Loading results...</span>
					</div>
				) : (posts.length === 0 && feeds.length === 0) ? (
					<div className="flex justify-center items-center h-64">
						<span className="text-xl faded-text">{keyword ? "No results found" : "Enter a search term"}</span>
					</div>
				) : (
					<>
						{selectedView === 'combined' && (
							<div className="flex flex-col w-99">
								{combinedItems.map((item, idx) =>
									item.type === 'post' ? (
										<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl w-full">
											<ContentWidget onPostRemoved={handlePostRemoved} post={item.data} />
										</div>
									) : (
										<div key={`feedtriplet-${idx}`} className="grid grid-cols-3 gap-3 med-mar-top w-full">
											{item.data.map(feed => (
												<FeedWidget key={feed.feed_id} feed={feed} isAuthenticated={isAuthenticated} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
											))}
										</div>
									)
								)}
							</div>
						)}
						{selectedView === 'posts' && (
							<div className="flex flex-col w-99">
								{posts.map(post => (
									<div key={post.post_id} className="bg-gray-800 rounded-xl w-full">
										<ContentWidget onPostRemoved={handlePostRemoved} post={post} />
									</div>
								))}
							</div>
						)}
						{selectedView === 'feeds' && (
							<div className="flex flex-col w-99">
								<div className="grid grid-cols-3 gap-3 med-mar-top w-full">
									{feeds.map(feed => (
										<FeedWidget key={feed.feed_id} feed={feed} isAuthenticated={isAuthenticated} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
									))}
								</div>
							</div>
						)}
						{isLoading && <p className="text-lg faded-text flex justify-center py-4">Loading more...</p>}
					</>
				)}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
				{keyword && <p className="large-text bold">Results for "{keyword}"</p>}
				<div className="error-message">{errorMessage}</div>
				<nav className="channel-list">
					<ul>
						<li className="channel-link" onClick={() => setSelectedView('combined')}>All results</li>
						<li className="channel-link" onClick={() => setSelectedView('posts')}>Posts</li>
						<li className="channel-link" onClick={() => { setSelectedView('feeds'); setDropdownOpen(false); }}>
							Feeds
							<div className="channel-dropdown" onClick={dropdownToggle}>
								{dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}
							</div>
						</li>
						{dropdownOpen && selectedView === 'feeds' && (
							<ul style={{ marginLeft: '10px' }}>
								<li className="channel-link" onClick={(e) => { e.stopPropagation(); setFeedTypeFilter('all'); setDropdownOpen(false); }}>All feeds</li>
								<li className="channel-link" onClick={(e) => { e.stopPropagation(); setFeedTypeFilter('group'); setDropdownOpen(false); }}>Groups</li>
								<li className="channel-link" onClick={(e) => { e.stopPropagation(); setFeedTypeFilter('user'); setDropdownOpen(false); }}>Users</li>
							</ul>
						)}
					</ul>
				</nav>
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={'search'} refreshPosts={refreshPosts} />
			</SwipeableAside>
		</div>
	);
};

export default SearchResults;