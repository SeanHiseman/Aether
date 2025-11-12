import axios from 'axios';
import ContentWidget from '../components/content/ContentWidget';
import { useEffect, useState, useRef } from 'react';

export default function RedditFeedPage() {
	const [posts, setPosts] = useState([]);
	const [loading, setLoading] = useState(true);
	const scrollRef = useRef(null);

	useEffect(() => {
		async function load() {
			try {
				const response = await axios.get('/api/reddit/feed', { withCredentials: true });
				setPosts(response.data.items || []);
			} catch (err) {
				console.error('Reddit feed error:', err);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	return (
		<div ref={scrollRef} className="channel-feed">
			{loading ? (
				<p className="large-text faded-text">Loading Reddit feed...</p>
			) : posts.length === 0 ? (
				<p className="large-text faded-text">No Reddit posts found</p>
			) : (
				<div className="flex flex-col w-99">
					{posts.map((post) => (
						<div key={post.post_id || Math.random()} className="bg-gray-800 rounded-xl">
							<ContentWidget
								post={post}
								canRemove={false}
								readOnly={true}
								onPostRemoved={() => {}}
								onSaveToggle={() => {}}
								feed={{}}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}