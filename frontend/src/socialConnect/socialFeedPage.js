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
	const [offset, setOffset] = useState(0);
	const [posts, setPosts] = useState([]);
	const location = useLocation();
	const isFetchingRef = useRef(false);
	const scrollRef = useRef(null);
	const hasLoadedRef = useRef(false); 

	async function loadFeed(isNextPage = false) {
		console.log("getting posts from backend")
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}
		if (isFetchingRef.current) return;
		isFetchingRef.current = true;
		try {
			const response = await api.get(`/${platform}/feed`, {
				params: { limit: 100, offset },
				withCredentials: true
			});
			console.log("load feed response:", response);
			const items = response.data.items || [];
			console.log("items.length:", items.length);
			if (isNextPage) {
				setPosts(prev => [...prev, ...items]);
			} else {
				setPosts(items);
			}
			if (items.length < 100) {
				setHasMore(false);
			} else {
				setOffset(prev => prev + 100);
			}
		} catch (error) {
			setErrorMessage('Error getting posts');
		} finally {
			isFetchingRef.current = false;
			setLoading(false);
		}
	}

	useEffect(() => {
		//Reset on platform change
		if (hasLoadedRef.current) {
			hasLoadedRef.current = false;
			setOffset(0);
			setHasMore(true);
			setPosts([]);
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
				console.log("fresh connection, getting cached posts");
				const cacheKey = `${platform}_initial_posts`;
				const cachedPosts = sessionStorage.getItem(cacheKey);
				if (cachedPosts) {
					try {
						const parsedPosts = JSON.parse(cachedPosts);
						setPosts(parsedPosts);
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
			const element = scrollRef.current;
			if (!element) return;
			const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
			const threshold = window.innerHeight * 1.5;
			if (distanceFromBottom <= threshold) {
				console.log("loading more posts")
				loadFeed(true);
			}
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, [hasMore, platform, isAuthenticated]);

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
					</div>
				)}
			</div>
			<aside className="right-aside">
				<p className="large-text bold">{capitalise(platform) || "Site not found"}</p>
				{/*<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={platform} />*/}
			</aside>
		</div>
	);
}