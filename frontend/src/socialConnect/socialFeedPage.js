import api from "../api";
import ExternalPostWidget from "./externalPostWidget";
import { useEffect, useState, useRef } from 'react';

export default function SocialFeedPage({ platform }) {
	const [posts, setPosts] = useState([]);
	const [loading, setLoading] = useState(true);
	const scrollRef = useRef(null);

	useEffect(() => {
		async function load() {
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

	return (
		<div className="standard-container">
			<div ref={scrollRef} className="channel-feed">
				{loading ? (
					<p className="large-text faded-text">Loading {platform} feed...</p>
				) : posts.length === 0 ? (
					<p className="large-text faded-text">No {platform} posts found</p>
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
				<p className="large-text bold">{platform || "Site not found"}</p>
			</aside>
		</div>
	);
}