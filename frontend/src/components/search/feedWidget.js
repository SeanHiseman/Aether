import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FollowerChangeButton from '../followerChangeButton';
import ManageConnectionButton from '../manageConnection';

const FeedWidget = ({ feed, viewerId }) => {
    const [followerCount, setFollowerCount] = useState(feed.follower_count);
    const [isFollowing, setIsFollowing] = useState(feed.isFollowing);

    //Updates follower count number
    const handleFollowerCountChange = (newIsFollowing) => {
        setFollowerCount(prevCount => newIsFollowing ? prevCount + 1 : prevCount - 1);
        setIsFollowing(newIsFollowing);
    };

    return (
        <div className="result-widget">
            <Link to={`/${feed.is_group ? 'g' : 'u'}/${feed.feed_name}/Main`}>
                <div className="search-result-profile">
                    <p className="large-widget-text">{feed.feed_name}</p>
                    <p className="description" >{feed.description}</p>
                </div>
            </Link>
            {!feed.is_group &&(
                <ManageConnectionButton viewerId={viewerId} receiverId={feed.feed_id} isRequestSent={feed.isConnectRequestSent} isConnected={feed.isConnected} />
            )}
            <div className="search-result-info-box">
                <div className="result-info-options">
                    <p>{feed.follower_count} {feed.follower_count === 1 ? 'follower' : 'followers'}</p>
                    <p>{feed.type ? "private" : "public"}</p>
                    <FollowerChangeButton feedId={feed.feed_id} followerId={viewerId} isFollowing={feed.isFollowing} isRequestSent={feed.isRequestSent} type={feed.type}/>
                    <p>{feed.type ? "private" : "public"}</p>
                </div>
                <Link to={`/${feed.is_group ? 'g' : 'u'}/${feed.feed_name}/Main`}>
                    <img className="large-group-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                </Link>
            </div>
        </div>
    )
}

export default FeedWidget