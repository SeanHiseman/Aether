import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../authContext";
import FollowerChangeButton from "../followerChangeButton";

const FeedWidget = ({ feed, updateFeeds }) => {
	const { viewer } = useContext(AuthContext);
	const imageUrl = feed?.feed_photo
		? `${feed?.feed_photo}`
		: "/media/site_images/blank-group-icon.jpg";

	return (
		<div className="explore-block bg-gray-800 rounded-lg flex flex-col items-flex-start feed-widget-container">
			<div className="feed-widget-info">
				<Link className="feed-widget-link" to={`/${feed?.is_group ? "g" : "u"}/${feed?.feed_name}/Main`}>
					<img className="small-feed-photo" src={imageUrl} onError={(e) => (e.currentTarget.src = "/media/site_images/blank-profile.png")} />
					<p className="feed-list-text feed-widget-name">{feed?.feed_name || "(Unknown Feed)"}</p>
				</Link>
				<p className="small-text faded-text feed-widget-type">{feed?.is_group ? "Group" : "User"}</p>
			</div>
			<p className="description">{feed?.description}</p>
			{viewer && feed?.feed_id !== viewer?.feed_id ? (
				<FollowerChangeButton feed={feed} showFollowers={true} showName={false} showVertical={true} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
			) : (
				<p className="small-text">{feed?.follower_count || '0'} {feed?.follower_count === 1 ? 'follower' : 'followers'}</p>
			)}
		</div>
	);
};

export default FeedWidget;