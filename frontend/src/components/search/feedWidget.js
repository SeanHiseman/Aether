import React from 'react';
import { Link } from 'react-router-dom';
import FollowerChangeButton from '../followerChangeButton';
import ManageConnectionButton from '../connections/manageConnectionButton';

const FeedWidget = ({ feed, isAuthenticated, viewerId }) => {
    const isViewingSelf = feed.feed_id === viewerId;

    return (
        <div className="result-widget">
            <Link to={`/${feed.is_group ? 'g' : 'u'}/${feed.feed_name}/Main`}>
                <div className="search-result-profile">
                    <p className="large-widget-text">{feed.feed_name}</p>
                    <p className="description" >{feed.description}</p>
                </div>
            </Link>
            {/*{!isViewingSelf && !feed.is_group && (
                <ManageConnectionButton feed={feed} viewerId={viewerId} />
            )}*/}
            <div className="search-result-info-box">
                <div className="result-info-options">
                    <p>{feed.type === 'private' ? "Private" : "Public"}</p>
                    {!isViewingSelf && isAuthenticated && (
                        <FollowerChangeButton feed={feed} viewerId={viewerId} />
                    )}
                </div>
                <Link to={`/${feed.is_group ? 'g' : 'u'}/${feed.feed_name}/Main`}>
                    <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                </Link>
            </div>
        </div>
    )
}

export default FeedWidget;