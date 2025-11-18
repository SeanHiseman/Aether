import api from "../api";
import AlgorithmSelector from "../algorithms/algorithmSelector";
import { AuthContext } from "../components/authContext";
import { capitalise } from "../functions/capitalise";
import ExternalPostWidget from "./externalPostWidget";
import { refreshConnectedAccounts } from "../functions/refreshConnectedAccounts";
import { useContext, useEffect, useState, useRef } from 'react';
import { useLocation } from "react-router-dom";

export default function SocialFeedPage({ platform }) {
	const { isAuthenticated } = useContext(AuthContext);
	const [loading, setLoading] = useState(true);
	const [posts, setPosts] = useState([]);
	const location = useLocation();
	const scrollRef = useRef(null);

	//When returning from Reddit or Mastodon redirect
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const connected = params.get("connected");
		if (connected === "reddit" || connected === "mastodon") {
			refreshConnectedAccounts();
			window.history.replaceState({}, "", location.pathname);
		}
	}, [location]);

	useEffect(() => {
		setLoading(true);
		setPosts([]);
		async function load() {
			if (!isAuthenticated) return;
			try {
				console.log("Loading feed for platform:", platform);
				const response = await api.get(`/${platform}/feed`, { withCredentials: true });
				console.log(`${platform} feed response:`, response);
				setPosts(response.data.items || []);
			} catch (error) {
				console.error('Feed error:', error);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [platform]);

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