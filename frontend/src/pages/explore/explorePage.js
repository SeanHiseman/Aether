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

const FETCH_LIMIT = 24;

const ExplorePage = () => {
	const [errorMessage, setErrorMessage] = useState("");
	const [feedPage, setFeedPage] = useState(0);
	const [feeds, setFeeds] = useState([]);
	const [filter, setFilter] = useState("all");
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [postPage, setPostPage] = useState(0);
	const [posts, setPosts] = useState([]);
	const [shownFeedIds, setShownFeedIds] = useState([]);
	const [shownPostIds, setShownPostIds] = useState([]);
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const { rightClasses } = useOutletContext();
	const scrollRef = useRef(null);
	const CLEANUP_THRESHOLD = 100;

	const fetchPosts = useCallback(async () => {
		try {
			console.log("fetching posts")
			const response = await axios.get("/api/explore_posts", {
				params: { filter, limit: FETCH_LIMIT, exclude: shownPostIds },
			});
			console.log("fetched posts", response.data)
			const newPosts = response.data.posts;
			setPosts(prev => [...prev, ...newPosts]);
			setShownPostIds(prev => [...prev, ...newPosts.map(p => p.post_id)]);
		} catch (error) {
			console.error("Error fetching posts:", error);
			setErrorMessage("Failed to fetch posts");
		}
	}, [filter, shownPostIds]);

	const fetchFeeds = useCallback(async () => {
		try {
			console.log("fetching feeds")
			const response = await axios.get("/api/explore_feeds", {
				params: { limit: FETCH_LIMIT, exclude: shownFeedIds.join(',') },
			});
			console.log("fetched feeds", response.data)
			const newFeeds = response.data.feeds;
			setFeeds(prev => [...prev, ...newFeeds]);
			setShownFeedIds(prev => [...prev, ...newFeeds.map(f => f.feed_id)]);
		} catch (error) {
			console.error("Error fetching feeds:", error);
			setErrorMessage("Failed to fetch feeds");
		}
	}, [shownFeedIds]);

	const loadMore = useCallback(async () => {
		if (loading || loadingMore) return;
		setLoadingMore(true);
		if (posts.length + feeds.length > CLEANUP_THRESHOLD) {
			setPosts(prev => prev.slice(-20));
			setFeeds(prev => prev.slice(-30));
		}
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
	}, [loading, loadingMore, filter, fetchPosts, fetchFeeds, posts.length, feeds.length]);

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		if (scrollRef.current.scrollTimeout) clearTimeout(scrollRef.current.scrollTimeout);
		scrollRef.current.scrollTimeout = setTimeout(() => {
			if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) loadMore();
		}, 100);
	}, [loadMore]);

	const combinedItems = useMemo(() => {
		if (filter !== "all") return [];
		const feedQuads = chunkFeedsToQuads(feeds);
		const postItems = posts.map(p => ({ type: "post", data: p }));
		const feedQuadItems = feedQuads.map(f => ({ type: "feedQuad", data: f }));
		const allItems = [...postItems, ...feedQuadItems];
		return shuffleArray(allItems.slice());
	}, [filter, posts, feeds]);

	//For feeds-only filter, chunk into groups of 4
	const feedQuads = useMemo(() => chunkFeedsToQuads(feeds), [feeds]);

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
		setShownFeedIds([]);
		setShownPostIds([]);
		const fetches = [];
		if (filter === "all" || filter === "posts") fetches.push(fetchPosts(0));
		if (filter === "all" || filter === "feeds") fetches.push(fetchFeeds(0));
		Promise.all(fetches).then(() => setLoading(false));
	}, [filter]);

	//Auto-load until scroll area is filled, or no more data is being fetched
	useEffect(() => {
		if (loading) return;
		const element = scrollRef.current;
		if (!element) return;
		const timeout = setTimeout(() => {
			if (element.scrollHeight <= element.clientHeight && !loadingMore) loadMore();
		}, 50);
		return () => clearTimeout(timeout);
	}, [loading, loadingMore, feeds.length, posts.length]);

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
								{combinedItems.map((item, idx) =>
									item.type === "post" ? (
										<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl">
											<SmallContentWidget post={item.data} />
										</div>
									) : (
										<div key={`feedquad-${idx}`} className="grid grid-cols-4 gap-3 w-full">
											{item.data.map(feed => (
												<FeedWidget
													key={feed.feed_id}
													feed={feed}
													isAuthenticated={isAuthenticated}
													viewerId={viewer?.feed_id}
												/>
											))}
										</div>
									)
								)}
							</div>
						)}
						{filter === "posts" && (
							<div className="flex flex-col gap-3 w-99">
								{posts.map(post => (
									<div key={post.post_id} className="bg-gray-800 rounded-xl">
										<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
									</div>
								))}
							</div>
						)}
						{filter === "feeds" && (
							<div className="flex flex-col gap-3 w-99">
								{feedQuads.map((feedQuad, idx) => (
									<div key={idx} className="grid grid-cols-4 gap-3 w-full">
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
							</div>
						)}
					</>
				)}
			</div>
			<aside className={`${rightClasses} w-80 bg-white`}>
				<p className="error-message">{errorMessage}</p>
				<p className="large-text">Filters</p>
				<nav className="channel-list">
					<ul>
						<li className="channel-link" onClick={() => setFilter("all")}>All</li>
						<li className="channel-link" onClick={() => setFilter("posts")}>Posts</li>
						<li className="channel-link" onClick={() => setFilter("feeds")}>Feeds</li>
					</ul>
				</nav>
				{isAuthenticated && <AlgorithmSelector locationId={"explore_page"} />} {/*Project code*/}
			</aside>
		</div>
	);
};

export default ExplorePage;