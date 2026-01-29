import { FaRetweet } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function RepostIndicator({ reposter, repostedAt }) {
	if (!reposter) return null;

	return (
		<div className="repost-indicator">
			<FaRetweet className="repost-icon" />
			<span>
				<Link to={`/u/${reposter?.feed_name}`} className="reposter-link">
					{reposter?.feed_name}
				</Link>
				{' '}reposted
			</span>
		</div>
	);
}
