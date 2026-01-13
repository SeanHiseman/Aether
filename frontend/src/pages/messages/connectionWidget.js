import { Link } from 'react-router-dom';
import { FaMinus, FaMinusCircle, FaPlusCircle } from 'react-icons/fa';

const ConnectionWidget = ({ connection, connectRequest, onAccept, onReject, onRemove, unreadCount = 0, viewerId }) => {
	const imageUrl = connection?.feed_photo
		? `${connection?.feed_photo}`
		: '/media/site_images/blank-profile.png';

	const isViewer = viewerId === connection?.feed_id;

	return (
		<div className="explore-block bg-gray-800 rounded-lg flex flex-col items-center">
			<Link to={`/connections/${connection?.feed_name}`} className="w-20 h-20 rounded-full overflow-hidden mb-2 relative">
				<img
					className="w-full h-full object-cover feed-img"
					src={imageUrl}
					onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'}
				/>
			</Link>
			<p className="text-lg font-bold text-white truncate mt-1 text-center">
				{connection?.feed_name}
			</p>
			{!isViewer && (
				<div className="flex flex-col gap-1 mt-2 w-full">
					{connectRequest ? (
						<>
							<button className="small-icon" onClick={() => onAccept(connectRequest)}>
								<FaPlusCircle />
								<p className="icon-text">Accept</p>
							</button>
							<button className="small-icon" onClick={() => onReject(connectRequest)}>
								<FaMinusCircle />
								<p className="icon-text">Reject</p>
							</button>
						</>
					) : onRemove ? (
						<button className="small-icon" onClick={() => onRemove(connection)}>
							<FaMinus />
							<p className="icon-text">Remove</p>
						</button>
					) : (
						<p className="small-text faded-text">No options provided</p>
					)}
				</div>
			)}
		</div>
	);
};

export default ConnectionWidget;