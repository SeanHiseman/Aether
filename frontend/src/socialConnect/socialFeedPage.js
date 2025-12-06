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
		const fetchLimit = platform === 'mastodon' ? 40 : 100;
		try {
			const response = await api.get(`/${platform}/feed`, {
				params: { limit: fetchLimit, offset },
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
			if (items.length < fetchLimit) {
				setHasMore(false);
			} else {
				setOffset(prev => prev + fetchLimit);
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
		// 1. Safety check: if ref is null, we can't attach listeners
		if (!element) return;

		const handleScroll = () => {
			// --- DEBUG 1: Prove the event is firing ---
			console.log("Scroll event fired on DIV");
			console.log("Status -> hasMore:", hasMore, "isFetching:", isFetchingRef.current);

			// 2. Check early returns AFTER logging
			if (!hasMore || isFetchingRef.current) return;

			// --- DEBUG 2: Check the math ---
			// Since we are listening to the element, we use element properties
			const totalHeight = element.scrollHeight;
			const scrolledDistance = element.scrollTop;
			const visibleHeight = element.clientHeight;
			
			// How far from bottom are we?
			const distanceRemaining = totalHeight - scrolledDistance - visibleHeight;
			const threshold = window.innerHeight * 1.5;

			console.log("Distance Remaining:", distanceRemaining);
			console.log("Threshold:", threshold);

			if (distanceRemaining <= threshold) {
				console.log("!!! LOADING MORE POSTS !!!");
				loadFeed(true);
			}
		};

		// 3. Attach to the ELEMENT, not the WINDOW
		element.addEventListener('scroll', handleScroll);
		
		return () => {
			// Cleanup the listener from the element
			element.removeEventListener('scroll', handleScroll);
		};
	}, [hasMore, platform, isAuthenticated, offset]);

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