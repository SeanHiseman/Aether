import axios from 'axios';
import React, { useCallback, useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../../components/authContext';

const FeedFollowers = ({ feed }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [followers, setFollowers] = useState([]);
    const { user } = useContext(AuthContext);

    const getFeedFollowers = useCallback(async () => {
        try {
            const response = await axios.get(`/api/get_feed_followers/${feed.feed_id}`);
            setFollowers(response.data.followers);
        } catch (error) {
            setErrorMessage('Error getting followers');
        }
    }, [feed.feed_id]);
    
    useEffect(() => {
        getFeedFollowers();            
    }, [getFeedFollowers]);

    //Used by both viewing followers and admins
    const removeFollower = async (follower) => {
        try {
            await axios.post('/api/unfollow_feed', { followerId: follower.followerFeed.feed_id, followedFeedId: feed.feed_id })
            getFeedFollowers();
        } catch (error) {
            setErrorMessage('Error removing follower');
        }
    };

    //Allows adding/remvoing of moderators
    const toggleModeratorStatus = async (follower) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                feedId: follower.followerFeed.feed_id,
                followerId: follower.follower_id,
                isMod: !follower.is_mod, //Opposite to current state
            });
            if (response.status === 200) {
                setFollowers((prevFollowers) =>
                    prevFollowers.map((f) =>
                        f.follower_id === follower.follower_id
                            ? { ...f, is_mod: !f.is_mod }
                            : f
                    )
                );
            }
        } catch (error) {
            setErrorMessage("Error toggling moderator status");
        }
    };

    return (
        <div className="channel-content">
            <p className="text36">Followers</p>
            {followers.length === 0 ? (
                <p className="text24">No followers</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {followers.map((follower, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="feed-link" to={`/u/${follower.followerFeed.feed_name}`}>
                                    <img className="large-feed-photo" src={`/${follower.followerFeed.feed_photo}`} alt="Feed" />
                                    <p className="text36 feed-name">{follower.followerFeed.feed_name}</p>
                                </Link>
                                {feed.is_group && (
                                    <button className="button" onClick={() => toggleModeratorStatus(follower)}>
                                        {follower.is_mod ? 'Remove as moderator' : 'Make moderator'}
                                    </button>
                                )}
                                {follower.followerFeed.feed_id !== user.userId &&
                                    <button className="button" onClick={() => removeFollower(follower)}>Remove follower
                                </button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default FeedFollowers;