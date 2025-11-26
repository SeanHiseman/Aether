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
	const [loading, setLoading] = useState(true);
	const [posts, setPosts] = useState([]);
	const location = useLocation();
	const scrollRef = useRef(null);
	const hasLoadedRef = useRef(false); 

	useEffect(() => {
		//Reset on platform change
		if (hasLoadedRef.current) {
			hasLoadedRef.current = false;
		}
	}, [platform]);

	useEffect(() => {
		if (hasLoadedRef.current) return;
		try {
			hasLoadedRef.current = true;
			const params = new URLSearchParams(location.search);
			const justConnected = params.get("connected");
			console.log('SocialFeedPage loading:', { platform, justConnected, isAuthenticated });
			//Check for cached posts from fresh connection
			if (justConnected === "true") {
				const cacheKey = `${platform}_initial_posts`;
				const cachedPosts = sessionStorage.getItem(cacheKey);
				console.log('Checking sessionStorage for key:', cacheKey);
				console.log('Cached posts found:', cachedPosts ? 'YES' : 'NO');
				if (cachedPosts) {
					try {
						const parsedPosts = JSON.parse(cachedPosts);
						console.log(`Loaded ${parsedPosts.length} cached ${platform} posts`);
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
			//Regular feed load from database/API
			async function loadFeed() {
				if (!isAuthenticated) {
					setLoading(false);
					return;
				}
				setLoading(true);
				try {
					const response = await api.get(`/${platform}/feed`, { 
						withCredentials: true 
					});
					const items = response.data.items || [];
					console.log(`Loaded ${items.length} posts from API`);
					setPosts(items);
				} catch (error) {
					setErrorMessage('Error getting posts');
					setPosts([]);
				} finally {
					setLoading(false);
				}
			}
			loadFeed();
		} catch (error) {
			setErrorMessage('Error loading feed');
			setLoading(false);
		}
	}, [platform, location.search, isAuthenticated]);

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
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={platform} />
			</aside>
		</div>
	);
}