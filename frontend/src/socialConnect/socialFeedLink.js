import { Link, useLocation } from 'react-router-dom';

const SocialFeedLink = ({ logo, name, slug }) => {
	const location = useLocation();
	const isSelected = location.pathname.startsWith(`/feed/${slug}`);

	return (
		<div className={`feed-list-link-container ${isSelected ? 'selected' : ''}`}>
			<Link to={`/feed/${slug}`}>
				<div className="feed-list-item">
					<div className="feed-list-link">
						<img className="small-feed-photo" src={logo} />
						<p className="small-text">{name}</p>
					</div>
				</div>
			</Link>
		</div>
	);
};

export default SocialFeedLink;