import AlgorithmSelector from "../../algorithms/algorithmSelector";
import api from '../../api';
import { AuthContext } from "../../components/authContext";
import { ChunkFeeds } from "../../functions/chunkFeeds";
import ContentWidget from "../../components/content/contentWidget";
import ExternalPostWidget from '../../socialConnect/externalPostWidget';
import FeedWidget from "../../components/content/feedWidget";
import { FaGlobe, FaHome } from 'react-icons/fa';
import PlatformConnect from "../../socialConnect/platformConnect";
import SwipeableAside from "../../components/swipeableAside";
import { useMemo, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
const FETCH_LIMIT = 100;

const ExplorePage = () => {
	const [errorMessage, setErrorMessage] = useState("");
	const [feedPage, setFeedPage] = useState(0);
	const [feeds, setFeeds] = useState([]);
	const [filter, setFilter] = useState("all");
	const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
	const [hasMorePosts, setHasMorePosts] = useState(true);
	const [includeExternal, setIncludeExternal] = useState(true);
	const [includeNative, setIncludeNative] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [postPage, setPostPage] = useState(0);
	const [posts, setPosts] = useState([]);
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext();
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const scrollRef = useRef(null);

	const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

	const fetchPosts = useCallback(async (page = 0) => {
		try {
			console.log(`[EXPLORE FRONTEND] Fetching posts - page=${page}, offset=${page * FETCH_LIMIT}`);
			const followedFeeds = JSON.parse(localStorage.getItem("followedFeeds") || "[]");
			const recentUpvotes = JSON.parse(localStorage.getItem("recentUpvotes") || "[]");
			const followedFeedIds = followedFeeds.map(f => f.feed_id);
			const response = await api.post("/explore_posts", {
				limit: FETCH_LIMIT,
				offset: page * FETCH_LIMIT,
				followedFeedIds,
				recentUpvotes
			});
			const newPosts = Array.isArray(response.data?.posts) ? response.data.posts : [];
			const status = response.data?.status;
			const message = response.data?.message;
			const hasMore = response.data?.hasMore ?? false;
			console.log(`[EXPLORE FRONTEND] Received ${newPosts.length} posts, hasMore=${hasMore}, status=${status}`);
			setHasMorePosts(hasMore);
			if (page === 0 && message) {
				setErrorMessage(message);
			} else if (page === 0) {
				setErrorMessage("");
			}
			if (page === 0) {
				setPosts(newPosts);
			} else {
				setPosts(prev => {
					console.log(`[EXPLORE FRONTEND] Appending ${newPosts.length} posts to existing ${prev.length} posts`);
					return [...prev, ...newPosts];
				});
			}
		} catch (error) {
			console.error("[EXPLORE FRONTEND] Error fetching posts:", error);
			setErrorMessage(error.response?.data?.message || "Failed to fetch posts");
			setHasMorePosts(false);
		}
	}, []);

	const fetchFeeds = useCallback(async (page = 0) => {
		try {
			//Get followed feeds from localStorage
			const cached = localStorage.getItem("followedFeeds");
			const excludedFeedIds = cached ? JSON.parse(cached).map(f => f.feed_id) : [];
			const response = await api.post("/explore_feeds", {
				limit: 60, //5 posts then 3 feeds
				offset: page * 60, 
				exclude: [...excludedFeedIds] 
			});
			const newFeeds = response.data?.feeds || [];
			if (newFeeds.length === 0) {
				setHasMoreFeeds(false);
				return;
			}
			setHasMoreFeeds(response.data?.hasMore ?? false);
			if (page === 0) {
				setFeeds(newFeeds);
			} else {
				setFeeds(prev => [...prev, ...newFeeds]);
			}
		} catch (error) {
			setErrorMessage(error.response?.data?.message || "Failed to fetch feeds");
			setHasMoreFeeds(false);
		}
	}, []);

	const loadMore = useCallback(async () => {
		if (isLoading) {
			console.log("[EXPLORE FRONTEND] loadMore skipped - already loading");
			return;
		}
		if (filter === "all") {
			console.log(`[EXPLORE FRONTEND] loadMore - hasMorePosts=${hasMorePosts}, hasMoreFeeds=${hasMoreFeeds}, postPage=${postPage}, feedPage=${feedPage}`);
			if (!hasMorePosts && !hasMoreFeeds) {
				console.log("[EXPLORE FRONTEND] loadMore stopped - no more posts or feeds");
				return;
			}
			setIsLoading(true);
			const nextPostPage = postPage + 1;
			const nextFeedPage = feedPage + 1;
			if (hasMorePosts) {
				console.log(`[EXPLORE FRONTEND] Fetching more posts - page ${nextPostPage}`);
				await fetchPosts(nextPostPage);
			}
			if (hasMoreFeeds) {
				console.log(`[EXPLORE FRONTEND] Fetching more feeds - page ${nextFeedPage}`);
				await fetchFeeds(nextFeedPage);
			}
			if (hasMorePosts) setPostPage(nextPostPage);
			if (hasMoreFeeds) setFeedPage(nextFeedPage);
			setIsLoading(false);
		} else if (filter === "posts" && hasMorePosts) {
			setIsLoading(true);
			const nextPostPage = postPage + 1;
			await fetchPosts(nextPostPage);
			setPostPage(nextPostPage);
			setIsLoading(false);
		} else if (filter === "feeds" && hasMoreFeeds) {
			setIsLoading(true);
			const nextFeedPage = feedPage + 1;
			await fetchFeeds(nextFeedPage);
			setFeedPage(nextFeedPage);
			setIsLoading(false);
		}
	}, [isLoading, filter, fetchPosts, fetchFeeds, postPage, feedPage, hasMorePosts, hasMoreFeeds]);

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element || isLoading) return;
		const threshold = window.innerHeight * 2; //Fetch new content 2 vertical height away from bottom
		const scrollTop = element.scrollTop;
		const clientHeight = element.clientHeight;
		const scrollHeight = element.scrollHeight;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		if (distanceFromBottom <= threshold) {
			console.log(`[EXPLORE FRONTEND] Scroll threshold reached - distance from bottom: ${distanceFromBottom}px, threshold: ${threshold}px`);
			loadMore();
		}
	}, [loadMore, isLoading]);

	//Filter posts by native/external toggles (but keep viewed posts visible to prevent jumping)
	const visiblePosts = useMemo(() => {
		const filtered = posts.filter(p =>
			(includeNative && !p.is_external) || (includeExternal && p.is_external)
		);
		console.log(`[EXPLORE FRONTEND] Posts filtered: ${posts.length} total, ${filtered.length} visible (native toggle: ${includeNative}, external toggle: ${includeExternal})`);
		return filtered;
	}, [posts, includeNative, includeExternal]);

	const combinedItems = useMemo(() => {
		if (filter !== "all") return [];
		const feedTriplets = ChunkFeeds(feeds, 3).map(f => ({ type: "feedTriplet", data: f }));
		const postItems = visiblePosts.map(p => ({ type: "post", data: p }));
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
	}, [filter, visiblePosts, feeds]);

	const refreshPosts = () => {
		setErrorMessage('');
		setRefreshTrigger(prev => prev + 1);
	};

	//Reset all state on filter change and fetch initial batch
	useEffect(() => {
		setIsLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]);
		setPosts([]);
		const fetches = [];
		if (filter === "all" || filter === "posts") fetches.push(fetchPosts(0));
		if (filter === "all" || filter === "feeds") fetches.push(fetchFeeds(0));
		Promise.all(fetches).then(() => setIsLoading(false));
	}, [filter, fetchPosts, fetchFeeds]);

	//Manual refresh trigger
	useEffect(() => {
		if (refreshTrigger === 0) return; 
		setIsLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]);
		setPosts([]);
		const fetches = [];
		if (filter === "all" || filter === "posts") fetches.push(fetchPosts(0));
		if (filter === "all" || filter === "feeds") fetches.push(fetchFeeds(0));
		Promise.all(fetches).then(() => setIsLoading(false));
	}, [refreshTrigger, fetchPosts, fetchFeeds, filter]);

	const isInitialLoad = isLoading && posts.length === 0 && feeds.length === 0;

	document.title = "Explore";
	return (
		<div className="standard-container">
			<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
				{isInitialLoad ? (
					<div className="flex justify-center items-center h-64">
						<span className="large-text faded-text">Loading...</span>
					</div>
				) : posts.length > 0 && visiblePosts.length === 0 && filter !== "feeds" ? (
					<p className="large-text faded-text">All posts hidden</p>
				) : (
					<>
						{filter === "all" && (
							<div className="flex flex-col w-99">
								{combinedItems.map((item, idx) => item?.type === "post" ? (
									<div key={`post-${item?.data?.post_id}`} className="bg-gray-800 rounded-xl">
										{item.data.is_external ? (
											<ExternalPostWidget post={item.data} />
										) : (
											<ContentWidget post={item.data} />
										)}
									</div>
								) : (
									<div key={`feedtriplet-${idx}`} className="grid grid-cols-3 gap-3 w-full med-mar-bottom">
										{item.data.map(feed => (
											<FeedWidget key={feed?.feed_id} feed={feed} isAuthenticated={isAuthenticated} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
										))}
									</div>
								)
								)}
							</div>
						)}
						{filter === "posts" && (
							<div className="flex flex-col w-99">
								{visiblePosts.map(post => (
									<div key={post.post_id} className="bg-gray-800 rounded-xl">
										{post.is_external ? (
											<ExternalPostWidget post={post} />
										) : (
											<ContentWidget post={post} />
										)}
									</div>
								))}
							</div>
						)}
						{filter === "feeds" && (
							<div className="flex flex-col gap-3 w-99 med-mar-bottom">
								<div className="grid grid-cols-3 gap-3 w-full">
									{feeds.map(feed => (
										<FeedWidget key={feed?.feed_id} feed={feed} isAuthenticated={isAuthenticated} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
									))}
								</div>
							</div>
						)}
					</>
				)}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
				<p className="large-text bold">Explore</p>
				<nav className="channel-list">
					<ul>
						<li className="channel-link" onClick={() => setFilter("all")}>All</li>
						<li className="channel-link" onClick={() => setFilter("posts")}>Posts</li>
						<li className="channel-link" onClick={() => setFilter("feeds")}>Feeds</li>
					</ul>
				</nav>
				<p className="small-text faded-text">{isAuthenticated ? errorMessage : ""}</p>
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={"explore"} refreshPosts={refreshPosts} />
				<div className="flex flex-col items-flex-start">
					<button onClick={() => setIncludeNative(!includeNative)} className="small-icon">
						<FaHome />
						<p className="icon-text">{includeNative ? "Hide native" : "Show native"}</p>
					</button>
					<button onClick={() => setIncludeExternal(!includeExternal)} className="small-icon">
						<FaGlobe />
						<p className="icon-text">{includeExternal ? "Hide external" : "Show external"}</p>
					</button>
				</div>
				<PlatformConnect />
			</SwipeableAside>
		</div>
	);
};

export default ExplorePage;