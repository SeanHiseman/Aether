import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../authContext";
import FollowerChangeButton from "../followerChangeButton";

const FeedWidget = ({ feed }) => {
	const { viewer } = useContext(AuthContext);
	const imageUrl = feed.feed_photo
		? `/${feed.feed_photo}`
		: "/media/site_images/blank-group-icon.jpg";

	return (
		<div className="explore-block bg-gray-800 rounded-lg p-4 flex flex-col items-center">
			<Link to={`/${feed.is_group ? "g" : "u"}/${feed.feed_name}/Main`} className="w-20 h-20 rounded-full overflow-hidden mb-2">
				<img className="w-full h-full object-cover" src={imageUrl} alt={`${feed.feed_name} profile`} />
			</Link>
			{feed.feed_id !== viewer.feed_id && (
				<FollowerChangeButton feed={feed} showName={true} showVertical={false} viewerId={viewer.feed_id} />
			)}
			{feed.feed_id === viewer.feed_id && (
				<p className="text-lg font-bold text-white truncate mt-1">
					{feed.feed_name}
				</p>
			)}
		</div>
	);
};

export default FeedWidget;