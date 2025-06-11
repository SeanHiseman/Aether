import axios from 'axios';
import React, { useCallback, useEffect, useState, useContext } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AuthContext } from '../../../components/authContext';
import { FaCrown, FaMinus, FaMinusCircle, FaPlusCircle } from 'react-icons/fa';

const FeedFollowers = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [followers, setFollowers] = useState([]);
    const { user, viewer } = useContext(AuthContext);
    const { feed, setFeed } = useOutletContext();

    const getFeedFollowers = useCallback(async () => {
        try {
            const response = await axios.get(`/api/get_feed_followers/${feed.feed_id}`);
            setFollowers(response.data.followers);
        } catch (error) {
            setErrorMessage('Error getting followers');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [feed.feed_id]);

    useEffect(() => {
        getFeedFollowers();
    }, [getFeedFollowers]);

    const removeFollower = async (follower) => {
        try {
            await axios.post('/api/unfollow_feed', { followerId: follower.follower_id, followedFeedId: feed.feed_id });
            setFollowers((prev) => prev.filter((f) => f.follower_id !== follower.follower_id));
            setFeed((prevFeed) => ({ ...prevFeed, follower_count: prevFeed.follower_count - 1 }));
        } catch (error) {
            setErrorMessage('Error removing follower');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const toggleAdminStatus = async (follower) => {
        if (follower.follower_id === viewer.feed_id && follower.is_admin) { //If removing self as admin
            if (!window.confirm("Are you sure you want to remove yourself as an admin? You will lose admin privileges.")) {
                return;
            }
        }
        try {
            const response = await axios.post('/api/toggle_admin', {
                feedId: feed.feed_id,
                followerId: follower.follower_id,
                isAdmin: !follower.is_admin,
            });
            if (response.status === 200) {
                setFollowers((prev) =>
                    prev.map((f) =>
                        f.follower_id === follower.follower_id ? { ...f, is_admin: !f.is_admin } : f
                    )
                );
            }
        } catch (error) {
            setErrorMessage("Error toggling admin status");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const toggleModeratorStatus = async (follower) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                feedId: feed.feed_id,
                followerId: follower.follower_id,
                isMod: !follower.is_mod,
            });
            if (response.status === 200) {
                setFollowers((prev) =>
                    prev.map((f) =>
                        f.follower_id === follower.follower_id ? { ...f, is_mod: !f.is_mod } : f
                    )
                );
            }
        } catch (error) {
            setErrorMessage("Error toggling moderator status");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const transferOwnership = async (follower) => {
        if (!window.confirm("Are you sure you want to transfer ownership? This action cannot be undone.")) return;
        try {
            const response = await axios.post('/api/transfer_ownership', {
                feedId: feed.feed_id,
                newOwnerId: follower.followerFeed.feed_owner,
            });
            if (response.status === 200) {
                setFeed((prevFeed) => ({ ...prevFeed, feed_owner: follower.follower_id }));
            }
        } catch (error) {
            setErrorMessage("Error transferring ownership");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="channel-content">
            <div className="followers-header">
                <p className="text36">Followers</p>
                {feed.is_group && <p className="text24">Moderators remove content and followers</p>}
                {feed.is_group && <p className="text24">Admins remove content, appoint and dismiss mods, and make feed changes</p>}
            </div>
            {followers.length === 0 ? (
                <p className="text24">No followers</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {followers.map((follower, index) => {
                        let role = "Follower";
                        if (follower.is_mod) role = "Moderator";
                        if (follower.is_admin) role = "Admin";
                        if (follower.followerFeed.feed_owner === feed.feed_owner) role = "Leader"; 
                        return (
                            <li key={index}>
                                <div className="result-widget">
                                    <Link className="feed-link" to={`/u/${follower.followerFeed.feed_name}`}>
                                        <img className="large-feed-photo" src={`/${follower.followerFeed.feed_photo}`} alt="Feed" />
                                        <p className="text36 feed-name">{follower.followerFeed.feed_name}</p>
                                    </Link>
                                    {feed.is_group && (<p className="text24">{role}</p>)}
                                    {user.user_id !== follower.follower_id && (
                                        <>
                                            {/* Admins can make/remove moderators, except the owner */}
                                            {feed.isAdmin && !follower.is_admin && feed.is_group && (
                                                <button className="small-icon" onClick={() => toggleModeratorStatus(follower)}>
                                                    {follower.is_mod ? <FaMinusCircle /> : <FaPlusCircle />}
                                                    <p className="icon-text">{follower.is_mod ? 'Remove as moderator' : 'Make moderator'}</p>
                                                </button>
                                            )}
                                            {/* Feed owner can see and change admin status */}
                                            {feed.isAdmin && follower.followerFeed.feed_owner !== feed.feed_owner && feed.is_group && (
                                                <button className="small-icon" onClick={() => toggleAdminStatus(follower)}>
                                                    {follower.is_admin ? <FaMinusCircle /> : <FaPlusCircle />}
                                                    <p className="icon-text">{follower.is_admin ? 'Remove as admin' : 'Make admin'}</p>
                                                </button>
                                            )}
                                            {/* Feed owner can transfer ownership, but not to themselves */}
                                            {feed.isOwner && follower.is_admin && follower.followerFeed.feed_owner !== feed.feed_owner && feed.is_group && (
                                                <button className="small-icon" onClick={() => transferOwnership(follower)}>
                                                    <FaCrown />
                                                    <p className="icon-text">Make Feed Owner</p>
                                                </button>
                                            )}
                                            {/* Moderators can remove regular followers but not other moderators/admins */}
                                            {(feed.isMod && !follower.is_admin && !follower.is_mod) && (
                                                <button className="small-icon" onClick={() => removeFollower(follower)}>
                                                    <FaMinus />
                                                    <p className="icon-text">Remove follower</p>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default FeedFollowers;