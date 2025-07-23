import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../components/authContext";
import axios from "axios";
import SmallContentWidget from "../../components/content/smallContentWidget";
import FeedWidget from "../../components/content/feedWidget";
import { useOutletContext } from "react-router-dom";

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
					params: { filter, limit: 4, exclude: shownPostIds },
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
					params: { limit: 6, exclude: shownFeedIds },
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

	const loadMore = async () => {
		if (loading || loadingMore) return;
		setLoadingMore(true);
		if (posts.length + feeds.length > CLEANUP_THRESHOLD) {
			setPosts(prev => prev.slice(-20)); 
			setFeeds(prev => prev.slice(-30));
		}
		const nextPostPage = postPage + 1;
		const nextFeedPage = feedPage + 1;
		await Promise.all([fetchPosts(nextPostPage), fetchFeeds(nextFeedPage)]);
		setPostPage(nextPostPage);
		setFeedPage(nextFeedPage);
		setLoadingMore(false);
	};

	const handleScroll = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;

		if (scrollRef.current.scrollTimeout) {
			clearTimeout(scrollRef.current.scrollTimeout);
		}
		scrollRef.current.scrollTimeout = setTimeout(() => {
			if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
				loadMore();
			}
		}, 100);
	}, [loadingMore, loading]);

	const renderAllContent = useCallback(() => {
		let feedIndex = 0;
		let postIndex = 0;
		const sections = [];
		const totalSections = Math.ceil(Math.max(posts.length / 4, feeds.length / 6));
		for (let i = 0; i < totalSections; i++) {
			if (postIndex < posts.length) {
				sections.push(
					<div key={`posts-${postIndex}`} className="grid grid-cols-2 gap-3 mb-3">
						{posts.slice(postIndex, postIndex + 4).map(post => (
							<div key={post.post_id} className="col-span-1 md:col-span-2 bg-gray-800 rounded-xl shadow hover:shadow-lg transition h-full">
								<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
							</div>
						))}
					</div>
				);
				postIndex += 4;
			}
			if (feedIndex < feeds.length) {
				sections.push(
					<div key={`feeds-${feedIndex}`} className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
						{feeds.slice(feedIndex, feedIndex + 6).map(feed => (
							<FeedWidget key={feed.feed_id} feed={feed} isAuthenticated={isAuthenticated} viewerId={viewer?.feed_id} />
						))}
					</div>
				);
				feedIndex += 6;
			}
		}
		return sections;
	}, [posts, feeds, isAuthenticated, viewer?.feed_id]);

	useEffect(() => {
		return () => {
			if (scrollRef.current?.scrollTimeout) {
				clearTimeout(scrollRef.current.scrollTimeout);
			}
		};
	}, []);

	useEffect(() => {
		setLoading(true);
		setFeedPage(0);
		setPostPage(0);
		setFeeds([]); 
		setPosts([]);
		Promise.all([fetchPosts(0), fetchFeeds(0)]).then(() => setLoading(false));
	}, [filter]);

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
						{filter === "all" && renderAllContent()}
						{filter === "posts" && (
							<div className="grid grid-cols-2 gap-3 mb-3">
								{posts.map(post => (
									<div key={post.post_id} className="col-span-1 sm:col-span-1 md:col-span-2 bg-gray-800 rounded-xl">
										<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
									</div>
								))}
							</div>
						)}
						{filter === "channels" && (
							<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
								{feeds.map(feed => (
									<FeedWidget
										key={feed.feed_id}
										feed={feed}
										isAuthenticated={isAuthenticated}
										viewerId={viewer?.feed_id}
									/>
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