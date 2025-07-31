import { useMemo, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../components/authContext";
import axios from "axios";
import SmallContentWidget from "../../components/content/smallContentWidget";
import FeedWidget from "../../components/content/feedWidget";
import { useOutletContext } from "react-router-dom";

function chunkFeedsToPairs(feeds) {
	const pairs = [];
	for (let i = 0; i < feeds.length; i += 2) {
		pairs.push(feeds.slice(i, i + 2));
	}
	return pairs;
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
	const CLEANUP_THRESHOLD = 100; //Remove old posts and feeds from rendered list

	const fetchPosts = useCallback(
		async () => {
			try {
				const res = await axios.get("/api/explore_posts", {
					params: { filter, limit: FETCH_LIMIT, exclude: shownPostIds },
				});
				const newPosts = res.data.posts;
				setPosts(prev => [...prev, ...newPosts]);
				setShownPostIds(prev => [...prev, ...newPosts.map(p => p.post_id)]);
			} catch (error) {
				setErrorMessage("Failed to fetch posts");
			}
		},
		[filter, shownPostIds]
	);

	const fetchFeeds = useCallback(
		async () => {
			try {
				const res = await axios.get("/api/explore_feeds", {
					params: { limit: FETCH_LIMIT, exclude: shownFeedIds },
				});
				const newFeeds = res.data.feeds;
				setFeeds(prev => [...prev, ...newFeeds]);
				setShownFeedIds(prev => [...prev, ...newFeeds.map(f => f.feed_id)]);
			} catch (error) {
				setErrorMessage("Failed to fetch feeds");
			}
		},
		[shownFeedIds]
	);

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
		} else if (filter === "channels") {
			const nextFeedPage = feedPage + 1;
			await fetchFeeds(nextFeedPage);
			setFeedPage(nextFeedPage);
		}
		setLoadingMore(false);
	}, [loading, loadingMore, filter, postPage, feedPage, fetchPosts, fetchFeeds, posts.length, feeds.length]);

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		if (scrollRef.current.scrollTimeout) {
			clearTimeout(scrollRef.current.scrollTimeout);
		}
		scrollRef.current.scrollTimeout = setTimeout(() => {
			if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
				loadMore();
			}
		}, 100);
	}, [loadingMore, loading, filter, posts.length, feeds.length, loadMore]);

	const combinedItems = useMemo(() => {
		if (filter !== "all") return [];
		const feedPairs = chunkFeedsToPairs(feeds);
		const postItems = posts.map(p => ({ type: "post", data: p }));
		const feedPairItems = feedPairs.map(f => ({ type: "feedPair", data: f }));
		const allItems = [...postItems, ...feedPairItems];
		return shuffleArray(allItems.slice());
	}, [filter, posts, feeds]);

	//2-column layout for all
	const [column1, column2] = useMemo(() => {
		if (filter !== "all") return [[], []];
		const col1 = [], col2 = [];
		combinedItems.forEach((item, i) => {
			(i % 2 === 0 ? col1 : col2).push(item);
		});
		return [col1, col2];
	}, [combinedItems, filter]);

	//2-column layout for posts
	const [postsCol1, postsCol2] = useMemo(() => {
		if (filter !== "posts") return [[], []];
		const col1 = [], col2 = [];
		posts.forEach((post, i) => {
			(i % 2 === 0 ? col1 : col2).push(post);
		});
		return [col1, col2];
	}, [posts, filter]);

	const feedPairs = useMemo(() => chunkFeedsToPairs(feeds), [feeds]);

	//2-column layout for feeds
	const [feedCol1, feedCol2] = useMemo(() => {
		if (filter !== "channels") return [[], []];
		const col1 = [], col2 = [];
		feedPairs.forEach((pair, i) => {
			(i % 2 === 0 ? col1 : col2).push(pair);
		});
		return [col1, col2];
	}, [feedPairs, filter]);

	useEffect(() => {
		return () => {
			if (scrollRef.current?.scrollTimeout) {
				clearTimeout(scrollRef.current.scrollTimeout);
			}
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
		if (filter === "all" || filter === "channels") fetches.push(fetchFeeds(0));
		Promise.all(fetches).then(() => setLoading(false));
	}, [filter]);

	//Auto-load until scroll area is filled, or no more data is being fetched
	useEffect(() => {
		if (loading) return;
		const element = scrollRef.current;
		if (!element) return;
		function tryLoadMore() {
			if (
				element.scrollHeight <= element.clientHeight &&
				!loadingMore
			) {
				if (
					(filter === "channels" && feeds.length >= FETCH_LIMIT) ||
					(filter === "posts" && posts.length >= FETCH_LIMIT) ||
					(filter === "all" && (feeds.length >= FETCH_LIMIT || posts.length >= FETCH_LIMIT))
				) {
					loadMore();
				}
			}
		}
		const timeout = setTimeout(tryLoadMore, 50);
		return () => clearTimeout(timeout);
	}, [loading, loadingMore, filter, feeds.length, posts.length]);

	return (
		<div className="standard-container">
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="channel-feed"
			>
				{loading ? (
					<div className="flex justify-center items-center h-64">
						<span className="text-xl text-gray-400">Loading...</span>
					</div>
				) : (
					<>
						{filter === "all" && (
							<div className="flex flex-row gap-3">
								{[column1, column2].map((column, colIdx) => (
									<div key={colIdx} className="flex flex-col flex-1 gap-3">
										{column.map((item, idx) =>
											item.type === "post" ? (
												<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl">
													<SmallContentWidget post={item.data} />
												</div>
											) : (
												<div key={`feedpair-${idx}`} className="grid grid-cols-2 gap-3">
													{item.data.map(feed => (
														<FeedWidget
															key={feed.feed_id}
															feed={feed}
															isAuthenticated={isAuthenticated}
															viewerId={viewer?.feed_id}
														/>
													))}
													{item.data.length === 1 && <div key="empty-cell"></div>}
												</div>
											)
										)}
									</div>
								))}
							</div>
						)}
						{filter === "posts" && (
							<div className="flex flex-row gap-3">
								{[postsCol1, postsCol2].map((column, colIdx) => (
									<div key={colIdx} className="flex flex-col flex-1">
										{column.map(post => (
											<div key={post.post_id} className="bg-gray-800 rounded-xl break-inside-avoid">
												<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
											</div>
										))}
									</div>
								))}
							</div>
						)}
						{filter === "channels" && (
							<div className="flex flex-row">
								{[feedCol1, feedCol2].map((column, colIdx) => (
									<div key={colIdx} className="flex flex-col flex-1 gap-3">
										{column.map((feedPair, idx) => (
											<div key={idx} className="grid grid-cols-2 gap-3">
												{feedPair.map(feed => (
													<FeedWidget
														key={feed.feed_id}
														feed={feed}
														isAuthenticated={isAuthenticated}
														viewerId={viewer?.feed_id}
													/>
												))}
												{feedPair.length === 1 && <div key="empty-cell"></div>}
											</div>
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
						<li className="channel-link" onClick={() => setFilter("all")}>
							All
						</li>
						<li className="channel-link" onClick={() => setFilter("posts")}>
							Posts
						</li>
						<li className="channel-link" onClick={() => setFilter("channels")}>
							Feeds
						</li>
					</ul>
				</nav>
			</aside>
		</div>
	);
};

export default ExplorePage;