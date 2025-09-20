import AlgorithmSelector from "../../algorithms/algorithmSelector";
import { AuthContext } from "../../components/authContext";
import axios from "axios";
import { useMemo, useCallback, useContext, useEffect, useRef, useState } from "react";
import SmallContentWidget from "../../components/content/smallContentWidget";
import FeedWidget from "../../components/content/feedWidget";
import { useOutletContext } from "react-router-dom";

function chunkFeedsToQuads(feeds) {
	const quads = [];
	for (let i = 0; i < feeds.length; i += 4) {
		quads.push(feeds.slice(i, i + 4));
	}
	return quads;
}

function shuffleArray(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

const FETCH_LIMIT = 20;
const RENDER_BUFFER = 10; // Number of items to render outside visible area

const ExplorePage = () => {
	const [errorMessage, setErrorMessage] = useState("");
	const [feedPage, setFeedPage] = useState(0);
	const [feeds, setFeeds] = useState([]);
	const [filter, setFilter] = useState("all");
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [postPage, setPostPage] = useState(0);
	const [posts, setPosts] = useState([]);
	
	// Track all fetched IDs (never cleared)
	const [allFetchedPostIds, setAllFetchedPostIds] = useState([]);
	const [allFetchedFeedIds, setAllFetchedFeedIds] = useState([]);
	
	// Track element heights and positions for virtual scrolling
	const [itemRefs, setItemRefs] = useState(new Map());
	const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
	
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const { rightClasses } = useOutletContext();
	const [refreshTrigger, setRefreshTrigger] = useState(false);
	const scrollRef = useRef(null);

	const fetchPosts = useCallback(async () => {
		try {
			const response = await axios.get("/api/explore_posts", {
				params: { filter, limit: FETCH_LIMIT, exclude: allFetchedPostIds },
			});
			const newPosts = response?.data?.posts || [];
			
			setPosts(prev => [...prev, ...newPosts]);
			
			// Always track all fetched IDs
			const newPostIds = newPosts.map(p => p?.post_id).filter(Boolean);
			setAllFetchedPostIds(prev => [...prev, ...newPostIds]);
			
		} catch (error) {
			setErrorMessage("Failed to fetch posts");
		}
	}, [filter, allFetchedPostIds]);

	const fetchFeeds = useCallback(async () => {
		try {
			const response = await axios.get("/api/explore_feeds", {
				params: { limit: FETCH_LIMIT, exclude: allFetchedFeedIds },
			});
			const newFeeds = response?.data?.feeds || [];
			
			setFeeds(prev => [...prev, ...newFeeds]);
			
			// Always track all fetched IDs
			const newFeedIds = newFeeds.map(f => f?.feed_id).filter(Boolean);
			setAllFetchedFeedIds(prev => [...prev, ...newFeedIds]);
			
		} catch (error) {
			setErrorMessage("Failed to fetch feeds");
		}
	}, [allFetchedFeedIds]);

	const loadMore = useCallback(async () => {
		if (loading || loadingMore) return;
		setLoadingMore(true);
		
		if (filter === "all") {
			const nextPostPage = postPage + 1;
			const nextFeedPage = feedPage + 1;
			await Promise.all([fetchPosts(nextPostPage), fetchFeeds(nextFeedPage)]);
			setPostPage(nextPostPage);
			setFeedPage(nextFeedPage);
		} else if (filter === "posts") {
			const nextPostPage = postPage + 1;
			await fetchPosts(nextPostPage);
			setPostPage(nextPostPage);
		} else if (filter === "feeds") {
			const nextFeedPage = feedPage + 1;
			await fetchFeeds(nextFeedPage);
			setFeedPage(nextFeedPage);
		}
		setLoadingMore(false);
	}, [loading, loadingMore, filter, fetchPosts, fetchFeeds, postPage, feedPage]);

	// Update visible range based on scroll position
	const updateVisibleRange = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;

		const scrollTop = element.scrollTop;
		const containerHeight = element.clientHeight;
		
		// Simple approach: estimate based on total items and scroll position
		let totalItems = 0;
		if (filter === "all") {
			totalItems = combinedItems.length;
		} else if (filter === "posts") {
			totalItems = posts.length;
		} else if (filter === "feeds") {
			totalItems = Math.ceil(feeds.length / 4); // Feed quads
		}

		if (totalItems === 0) return;

		// Rough estimation - adjust these values based on your average item heights
		const avgItemHeight = 250;
		const estimatedStart = Math.max(0, Math.floor(scrollTop / avgItemHeight) - RENDER_BUFFER);
		const estimatedEnd = Math.min(totalItems - 1, 
			Math.floor((scrollTop + containerHeight) / avgItemHeight) + RENDER_BUFFER);

		setVisibleRange({ start: estimatedStart, end: estimatedEnd });
	}, [filter, posts.length, feeds.length]);

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		
		updateVisibleRange();
		
		if (element.scrollTimeout) clearTimeout(element.scrollTimeout);
		element.scrollTimeout = setTimeout(() => {
			if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
				loadMore();
			}
		}, 100);
	}, [loadMore, updateVisibleRange]);

	const combinedItems = useMemo(() => {
		if (filter !== "all") return [];
		const feedQuads = chunkFeedsToQuads(feeds);
		const postItems = posts.map(p => ({ type: "post", data: p }));
		const feedQuadItems = feedQuads.map(f => ({ type: "feedQuad", data: f }));
		const allItems = [...postItems, ...feedQuadItems];
		return shuffleArray(allItems.slice());
	}, [filter, posts, feeds]);

	const refreshPosts = () => {
        setRefreshTrigger(!refreshTrigger);
    };

	//For feeds-only filter, chunk into groups of 4
	const feedQuads = useMemo(() => chunkFeedsToQuads(feeds), [feeds]);

	// Get visible items based on current range
	const visibleCombinedItems = useMemo(() => {
		if (filter !== "all") return [];
		return combinedItems.slice(visibleRange.start, visibleRange.end + 1);
	}, [combinedItems, visibleRange, filter]);

	const visiblePosts = useMemo(() => {
		if (filter !== "posts") return [];
		return posts.slice(visibleRange.start, visibleRange.end + 1);
	}, [posts, visibleRange, filter]);

	const visibleFeedQuads = useMemo(() => {
		if (filter !== "feeds") return [];
		return feedQuads.slice(visibleRange.start, visibleRange.end + 1);
	}, [feedQuads, visibleRange, filter]);

	useEffect(() => {
		updateVisibleRange();
	}, [updateVisibleRange, posts.length, feeds.length, filter]);

	useEffect(() => {
		return () => {
			if (scrollRef.current?.scrollTimeout) clearTimeout(scrollRef.current.scrollTimeout);
		};
	}, []);

	//Reset all state on filter change, and fetch the initial batch for the current filter
	useEffect(() => {
		setLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]);
		setPosts([]);
		setAllFetchedFeedIds([]);
		setAllFetchedPostIds([]);
		setVisibleRange({ start: 0, end: 50 });
		
		const fetches = [];
		if (filter === "all" || filter === "posts") fetches.push(fetchPosts());
		if (filter === "all" || filter === "feeds") fetches.push(fetchFeeds());
		Promise.all(fetches).then(() => setLoading(false));
	}, [filter]);

	//Refresh posts
	useEffect(() => {
		if (refreshTrigger === false) return; 
		setLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]);
		setPosts([]);
		setAllFetchedFeedIds([]);
		setAllFetchedPostIds([]);
		setVisibleRange({ start: 0, end: 50 });
		
		const fetches = [];
		if (filter === "all" || filter === "posts") fetches.push(fetchPosts());
		if (filter === "all" || filter === "feeds") fetches.push(fetchFeeds());
		Promise.all(fetches).then(() => setLoading(false));
	}, [refreshTrigger]);

	//Auto-load until scroll area is filled, or no more data is being fetched
	useEffect(() => {
		if (loading) return;
		const element = scrollRef.current;
		if (!element) return;
		const timeout = setTimeout(() => {
			if (element.scrollHeight <= element.clientHeight && !loadingMore) loadMore();
		}, 50);
		return () => clearTimeout(timeout);
	}, [loading, loadingMore]);

	// Create spacers to maintain scroll position
	const createSpacer = (height, key) => (
		<div key={key} style={{ height: `${height}px` }} />
	);

	// Estimate heights for spacers (adjust these based on your actual content)
	const estimatedPostHeight = 200;
	const estimatedFeedQuadHeight = 250;

	return (
		<div className="standard-container">
			<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
				{loading ? (
					<div className="flex justify-center items-center h-64">
						<span className="text-xl text-gray-400">Loading...</span>
					</div>
				) : (
					<>
						{filter === "all" && (
							<div className="flex flex-col gap-3 w-99">
								{/* Top spacer */}
								{visibleRange.start > 0 && createSpacer(
									visibleRange.start * (estimatedPostHeight + estimatedFeedQuadHeight) / 2,
									"top-spacer"
								)}
								
								{/* Visible items */}
								{visibleCombinedItems.map((item, idx) => {
									const actualIndex = visibleRange.start + idx;
									return item.type === "post" ? (
										<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl">
											<SmallContentWidget post={item.data} />
										</div>
									) : (
										<div key={`feedquad-${actualIndex}`} className="grid grid-cols-4 gap-3 w-full">
											{item.data.map(feed => (
												<FeedWidget
													key={feed.feed_id}
													feed={feed}
													isAuthenticated={isAuthenticated}
													viewerId={viewer?.feed_id}
												/>
											))}
										</div>
									);
								})}
								
								{/* Bottom spacer */}
								{visibleRange.end < combinedItems.length - 1 && createSpacer(
									(combinedItems.length - 1 - visibleRange.end) * (estimatedPostHeight + estimatedFeedQuadHeight) / 2,
									"bottom-spacer"
								)}
							</div>
						)}
						{filter === "posts" && (
							<div className="flex flex-col gap-3 w-99">
								{/* Top spacer */}
								{visibleRange.start > 0 && createSpacer(
									visibleRange.start * estimatedPostHeight,
									"top-spacer"
								)}
								
								{/* Visible posts */}
								{visiblePosts.map((post, idx) => (
									<div key={post.post_id} className="bg-gray-800 rounded-xl">
										<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
									</div>
								))}
								
								{/* Bottom spacer */}
								{visibleRange.end < posts.length - 1 && createSpacer(
									(posts.length - 1 - visibleRange.end) * estimatedPostHeight,
									"bottom-spacer"
								)}
							</div>
						)}
						{filter === "feeds" && (
							<div className="flex flex-col gap-3 w-99">
								{/* Top spacer */}
								{visibleRange.start > 0 && createSpacer(
									visibleRange.start * estimatedFeedQuadHeight,
									"top-spacer"
								)}
								
								{/* Visible feed quads */}
								{visibleFeedQuads.map((feedQuad, idx) => (
									<div key={visibleRange.start + idx} className="grid grid-cols-4 gap-3 w-full">
										{feedQuad.map(feed => (
											<FeedWidget
												key={feed.feed_id}
												feed={feed}
												isAuthenticated={isAuthenticated}
												viewerId={viewer?.feed_id}
											/>
										))}
									</div>
								))}
								
								{/* Bottom spacer */}
								{visibleRange.end < feedQuads.length - 1 && createSpacer(
									(feedQuads.length - 1 - visibleRange.end) * estimatedFeedQuadHeight,
									"bottom-spacer"
								)}
							</div>
						)}
					</>
				)}
			</div>
			<aside className={`${rightClasses} w-80 bg-white`}>
				<p className="error-message">{errorMessage}</p>
				<p className="large-text">Explore</p>
				<nav className="channel-list">
					<ul>
						<li className="channel-link" onClick={() => setFilter("all")}>All</li>
						<li className="channel-link" onClick={() => setFilter("posts")}>Posts</li>
						<li className="channel-link" onClick={() => setFilter("feeds")}>Feeds</li>
					</ul>
				</nav>
				{isAuthenticated && <AlgorithmSelector locationId={"explore"} refreshPosts={refreshPosts} />} {/*Project code*/}
			</aside>
		</div>
	);
};

export default ExplorePage;