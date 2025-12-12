import api from "../api";
import AlgorithmSelector from "../algorithms/algorithmSelector";
import { AuthContext } from "../components/authContext";
import { capitalise } from "../functions/capitalise";
import ExternalPostWidget from "./externalPostWidget";
import { refreshConnectedAccounts } from "../functions/refreshConnectedAccounts";
import { useContext, useEffect, useState, useRef } from 'react';
import { useLocation } from "react-router-dom";

export default function SocialFeedPage({ platform }) {
	const [errorMessage, setErrorMessage] = useState('');
	const { isAuthenticated } = useContext(AuthContext);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const [posts, setPosts] = useState([]);
	const [refreshTrigger, setRefreshTrigger] = useState(false);
	const location = useLocation();
	const isFetchingRef = useRef(false);
	const scrollRef = useRef(null);
	const hasLoadedRef = useRef(false); 

	async function loadFeed(isNextPage = false) {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}
		if (isFetchingRef.current) return;
		isFetchingRef.current = true;
		if (isNextPage) {
			setLoadingMore(true);
		}
		const fetchLimit = platform === 'mastodon' ? 40 : 100;
		try {
			const response = await api.get(`/${platform}/feed`, {
				params: { limit: fetchLimit, offset },
				withCredentials: true
			});
			const items = response.data.items || [];
			if (isNextPage) {
				setPosts(prev => [...prev, ...items]);
			} else {
				setPosts(items);
			}
			const returnedCount = items.length;
			if (returnedCount === 0) {
				setHasMore(false);
			} else {
				setOffset(prev => prev + returnedCount);
			}
		} catch (error) {
			setErrorMessage('Error getting posts');
		} finally {
			isFetchingRef.current = false;
			setLoading(false);
			setLoadingMore(false);
		}
	}

	useEffect(() => {
		if (!isAuthenticated) return;
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		loadFeed();
	}, [refreshTrigger, isAuthenticated]);

	useEffect(() => {
		//Reset on platform change
		if (hasLoadedRef.current) {
			hasLoadedRef.current = false;
			setOffset(0);
			setHasMore(true);
			setPosts([]);
			setLoading(true);
		}
	}, [platform]);

	useEffect(() => {
		if (hasLoadedRef.current) return;
		try {
			hasLoadedRef.current = true;
			const params = new URLSearchParams(location.search);
			const justConnected = params.get("connected");
			//Check for cached posts from fresh connection
			if (justConnected === "true") {
				const cacheKey = `${platform}_initial_posts`;
				const cachedPosts = sessionStorage.getItem(cacheKey);
				if (cachedPosts) {
					try {
						const parsedPosts = JSON.parse(cachedPosts);
						setPosts(parsedPosts);
						setOffset(parsedPosts.length);
						setLoading(false);
						//Clean up cache and URL
						sessionStorage.removeItem(cacheKey);
						window.history.replaceState({}, "", location.pathname);
						//Refresh connected accounts to update local storage
						refreshConnectedAccounts();
						return; //Exit early, don't fetch from API
					} catch (error) {
						setErrorMessage('Error getting posts');
						sessionStorage.removeItem(cacheKey);
					}
				}
				//If no cached posts but justConnected, still refresh accounts
				refreshConnectedAccounts();
				window.history.replaceState({}, "", location.pathname);
			}
			//Handle OAuth redirects (Reddit/Mastodon)
			if (justConnected === "reddit" || justConnected === "mastodon") {
				refreshConnectedAccounts();
				window.history.replaceState({}, "", location.pathname);
			}
			loadFeed();
		} catch (error) {
			setErrorMessage('Error loading feed');
			setLoading(false);
		}
	}, [platform, location.search, isAuthenticated]);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		const handleScroll = () => {
			if (!hasMore || isFetchingRef.current) return;
			const totalHeight = element.scrollHeight;
			const scrolledDistance = element.scrollTop;
			const visibleHeight = element.clientHeight;
			const distanceRemaining = totalHeight - scrolledDistance - visibleHeight;
			const threshold = window.innerHeight * 1.5;
			if (distanceRemaining <= threshold) {
				loadFeed(true);
			}
		};
		element.addEventListener('scroll', handleScroll);
		return () => {
			element.removeEventListener('scroll', handleScroll);
		};
	}, [hasMore, platform, isAuthenticated, offset]);

	const refreshPosts = () => {
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
        setRefreshTrigger(prev => !prev);
    };

	document.title = capitalise(platform) + " feed";
	if (!isAuthenticated) {
		return (
			<div className="standard-container">	
				<div className="channel-feed">
					<p className="large-text faded-text">Log in to view your {capitalise(platform)} feed.</p>
				</div>
				<aside className="right-aside">
					<p className="large-text bold">{platform || "Site not found"}</p>
				</aside>
			</div>
		);
	}
	
	return (
		<div className="standard-container">
			<div ref={scrollRef} className="channel-feed">
				<p className="error-message">{errorMessage}</p>
				{loading ? (
					<p className="large-text faded-text">Loading {capitalise(platform)} feed...</p>
				) : posts.length === 0 ? (
					<p className="large-text faded-text">No {capitalise(platform)} posts found</p>
				) : (
					<div className="flex flex-col w-99">
						{posts.map((post) => (
							<div key={post.post_id || Math.random()} className="bg-gray-800 rounded-xl">
								<ExternalPostWidget post={post} />
							</div>
						))}
						{loadingMore && (
							<p className="large-text faded-text">Loading more posts...</p>
						)}
						{!hasMore && posts.length > 0 && (
							<p className="large-text faded-text">No more posts to load</p>
						)}
					</div>
				)}
			</div>
			<aside className="right-aside">
				<p className="large-text bold">{capitalise(platform) || "Site not found"}</p>
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={platform} refreshPosts={refreshPosts} />
			</aside>
		</div>
	);
}