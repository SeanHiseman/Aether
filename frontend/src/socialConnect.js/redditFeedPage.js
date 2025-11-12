import RedditFeed from './redditFeed';

export default function RedditFeedPage() {
	return (
		<div className="standard-container">
			<RedditFeed />
			<aside className="right-aside">
				<p className="large-text bold">Reddit Feed</p>
			</aside>
		</div>
	);
}
