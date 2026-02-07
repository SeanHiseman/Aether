import { Link } from 'react-router-dom';
import { FaMinus, FaMinusCircle, FaPlusCircle } from 'react-icons/fa';

const ConnectionWidget = ({ connection, connectRequest, onAccept, onReject, onRemove, unreadCount = 0, viewerId }) => {
	const imageUrl = connection?.feed_photo
		? `${connection?.feed_photo}`
		: '/media/site_images/blank-profile.png';

	const isViewer = viewerId === connection?.feed_id;

	// Format the connection date
	const formatConnectionDate = (dateString) => {
		if (!dateString) return 'Unknown';
		const date = new Date(dateString);
		const options = { year: 'numeric', month: 'short', day: 'numeric' };
		return date.toLocaleDateString(undefined, options);
	};

	return (
		<div className="explore-block bg-gray-800 rounded-lg flex flex-col items-flex-start feed-widget-container">
			<div className="feed-widget-info">
				<Link className="feed-widget-link" to={`/connections/${connection?.feed_name}`}>
					<img className="small-feed-photo" src={imageUrl} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
					<p className="feed-list-text feed-widget-name">{connection?.feed_name || "(Unknown Connection)"}</p>
				</Link>
			</div>
			<p className="description">{connection?.description}</p>
			{!isViewer && (
				<>
					{connectRequest ? (
						<div className="flex flex-col gap-1 mt-2 w-full">
							<button className="small-icon" onClick={() => onAccept(connectRequest)}>
								<FaPlusCircle />
								<p className="icon-text">Accept</p>
							</button>
							<button className="small-icon" onClick={() => onReject(connectRequest)}>
								<FaMinusCircle />
								<p className="icon-text">Reject</p>
							</button>
						</div>
					) : (
						<>
							<p className="small-text faded-text">Connected since {formatConnectionDate(connection?.created_at)}</p>
							{onRemove && (
								<button className="small-icon" onClick={() => onRemove(connection)}>
									<FaMinus />
									<p className="icon-text">Remove</p>
								</button>
							)}
						</>
					)}
				</>
			)}
		</div>
	);
};

export default ConnectionWidget;