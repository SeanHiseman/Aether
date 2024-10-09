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
            const response = await axios.get('/api/get_feed_followers', {
                params: { feedId: feed.feed_id }
            });
            setFollowers(response.data);
        } catch (error) {
            setErrorMessage('Error getting followers');
        }
    }, [feed.feed_id]);
    
    useEffect(() => {
        getFeedFollowers();
    }, []);

    //Used by both viewing followers and admins
    const removeFollower = async (follower) => {
        try {
            await axios.post('/api/unfollow_group', { followerId: follower.feed_id, feedId: feed.feed_id })
            getFeedFollowers();
        } catch (error) {
            setErrorMessage('Error removing follower');
        }
    };

    //Allows adding/remvoing of moderators
    const toggleModeratorStatus = async (follower) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                feedId: feed.feed_id,
                followerId: follower.feed_id,
                isMod: !follower.is_mod, //Opposite to current state
            });
            if (response.status === 200) {
                getFeedFollowers();
            }
        } catch (error) {
            setErrorMessage("Error toggling moderator status");
        }
    };

    return (
        <div className="channel-content">
            <h2>Followers</h2>
            <ul className="content-list">
                <div className="error-message">{errorMessage}</div>
                {followers.map((follower, index) => (
                    <li key={index}>
                        <div className="result-widget">
                            <Link className="profile-link" to={`/u/${follower.feed_name}`}>
                                <img className="large-profile-photo" src={`/${follower.feed_photo}`} alt="Feed" />
                                <p className="text36 profile-name">{follower.feed_name}</p>
                            </Link>
                            <button className="button" onClick={() => toggleModeratorStatus(follower)}>
                                {follower.is_mod ? 'Remove as moderator' : 'Make moderator'}
                            </button>
                            {follower.feed_id !== user.userId &&
                                <button className="button" onClick={() => removeFollower(follower)}>Remove follower
                            </button>}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FeedFollowers;