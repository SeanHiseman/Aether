import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../components/authContext";
import axios from "axios";
import SmallContentWidget from "../../components/content/smallContentWidget";
import FeedWidget from "../../components/content/feedWidget";
import { useOutletContext } from "react-router-dom";

const ExplorePage = () => {
	const [feedPage, setFeedPage] = useState(0);
	const [feeds, setFeeds] = useState([]);
	const [filter, setFilter] = useState("all");
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [postPage, setPostPage] = useState(0);
	const [posts, setPosts] = useState([]);

	const { isAuthenticated, user, viewer } = useContext(AuthContext);
	const { rightClasses } = useOutletContext();

	const scrollRef = useRef(null);

	const fetchPosts = useCallback(
		async (page = 0) => {
			try {
				const res = await axios.get("/api/explore_posts", {
					params: { filter, limit: 6, offset: page * 6 },
				});
				setPosts(prev => (page === 0 ? res.data.posts : [...prev, ...res.data.posts]));
			} catch (err) {
				console.error("Failed to fetch posts", err);
			}
		},
		[filter]
	);

	const fetchFeeds = useCallback(
		async (page = 0) => {
			try {
				const res = await axios.get("/api/explore_feeds", {
					params: { limit: 6, offset: page * 6 },
				});
				setFeeds(prev => (page === 0 ? res.data.feeds : [...prev, ...res.data.feeds]));
			} catch (err) {
				console.error("Failed to fetch feeds", err);
			}
		},
		[filter]
	);

	useEffect(() => {
		setLoading(true);
		setFeedPage(0);
		setPostPage(0);
		Promise.all([fetchPosts(0), fetchFeeds(0)]).then(() => setLoading(false));
	}, [filter, fetchFeeds, fetchPosts]);

	const loadMore = async () => {
		if (loading || loadingMore) return;
		setLoadingMore(true);
		await Promise.all([fetchPosts(postPage + 1), fetchFeeds(feedPage + 1)]);
		setPostPage(p => p + 1);
		setFeedPage(f => f + 1);
		setLoadingMore(false);
	};

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) loadMore();
	};

	const renderAllContent = () => {
		let feedIndex = 0;
		let postIndex = 0;
		const sections = [];
		while (postIndex < posts.length || feedIndex < feeds.length) {
			if (postIndex < posts.length) {
				sections.push(
					<div key={`posts-${postIndex}`} className="grid grid-cols md:grid-cols-4 gap-3 mb-3">
						{posts.slice(postIndex, postIndex + 2).map(post => (
							<div key={post.post_id} className="col-span-1 md:col-span-2 bg-gray-800 rounded-xl shadow hover:shadow-lg transition h-full">
								<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
							</div>
						))}
					</div>
				);
				postIndex += 2;
			}
			if (feedIndex < feeds.length) {
				sections.push(
					<div key={`feeds-${feedIndex}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
						{feeds.slice(feedIndex, feedIndex + 3).map(feed => (
							<FeedWidget
								key={feed.feed_id}
								feed={feed}
								isAuthenticated={isAuthenticated}
								viewerId={viewer?.feed_id}
							/>
						))}
					</div>
				);
				feedIndex += 3;
			}
		}
		return sections;
	};

	return (
		<div className="standard-container">
			{/* Main Content */}
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
							<div className="grid grid-cols md:grid-cols-4 gap-3 mb-3">
								{posts.map(post => (
									<div key={post.post_id} className="col-span-1 md:col-span-2 bg-gray-800 rounded-xl shadow hover:shadow-lg transition h-full">
										<SmallContentWidget post={post} />
									</div>
								))}
							</div>
						)}
						{filter === "channels" && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
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
			{/* Right Sidebar (Filters) */}
			<aside className={`${rightClasses} w-80 bg-white`}>
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