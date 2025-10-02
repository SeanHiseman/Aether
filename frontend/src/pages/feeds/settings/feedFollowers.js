import axios from 'axios';
import { useCallback, useEffect, useState, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AuthContext } from '../../../components/authContext';
import { FormatNumber } from '../../../functions/formatNumber';
import FollowerWidget from './followerWidget';

const FeedFollowers = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [followers, setFollowers] = useState([]);
    const { user, viewer } = useContext(AuthContext);
    const { feed, setFeed } = useOutletContext();
    const [followerCount, setFollowerCount] = useState(feed?.follower_count || 0);

    const getFeedFollowers = useCallback(async () => {
        try {
            const response = await axios.get(`/api/get_feed_followers/${feed?.feed_id}`);
            setFollowers(response?.data?.followers);
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || "Error getting followers");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, [feed?.feed_id]);

    useEffect(() => {
        getFeedFollowers();
    }, [getFeedFollowers]);

    const removeFollower = async (follower) => {
        try {
            await axios.post('/api/unfollow_feed', { followerId: follower?.follower_id, followedFeedId: feed?.feed_id });
            setFollowers((prev) => prev.filter((f) => f?.follower_id !== follower?.follower_id));
            setFeed((prevFeed) => ({ ...prevFeed, follower_count: prevFeed?.follower_count - 1 }));
            setFollowerCount(prevCount => prevCount - 1);
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || "Error removing follower");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const toggleAdminStatus = async (follower) => {
        if (follower?.follower_id === viewer?.feed_id && follower?.is_admin) { //If removing self as admin
            if (!window.confirm("Are you sure you want to remove yourself as an admin? You will lose admin privileges.")) {
                return;
            }
        }
        try {
            const response = await axios.post('/api/toggle_admin', {
                feedId: feed?.feed_id,
                followerId: follower?.follower_id,
                isAdmin: !follower?.is_admin,
            });
            if (response.status === 200) {
                setFollowers((prev) =>
                    prev.map((f) =>
                        f?.follower_id === follower?.follower_id ? { ...f, is_admin: !f?.is_admin } : f
                    )
                );
            }
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || "Error toggling admin status");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const toggleModeratorStatus = async (follower) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                feedId: feed?.feed_id,
                followerId: follower?.follower_id,
                isMod: !follower?.is_mod,
            });
            if (response.status === 200) {
                setFollowers((prev) =>
                    prev.map((f) =>
                        f?.follower_id === follower?.follower_id ? { ...f, is_mod: !f?.is_mod } : f
                    )
                );
            }
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || "Error toggling moderator status");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const transferOwnership = async (follower) => {
        if (!window.confirm("Are you sure you want to transfer ownership? This action cannot be undone.")) return;
        try {
            const response = await axios.post('/api/transfer_ownership', {
                feedId: feed?.feed_id,
                newOwnerId: follower?.followerFeed?.feed_owner,
            });
            if (response?.status === 200) {
                setFeed((prevFeed) => ({ ...prevFeed, feed_owner: follower?.follower_id }));
            }
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || "Error transferring ownership");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="channel-content">
            <div className="followers-header">
                <p className="large-text bold">{FormatNumber(followerCount)} {followerCount === 1 ? 'follower' : 'followers'}</p>
                {feed?.is_group && <p className="small-text">Moderators remove content and followers</p>}
                {feed?.is_group && <p className="small-text">Admins remove content, appoint and dismiss mods, and make feed changes</p>}
            </div>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
           {followers.length === 0 ? (
                <p className="medium-text faded-text">No followers</p>
           ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full">
                    {followers.map((follower, idx) => (
                        <FollowerWidget
                            key={follower?.follower_id || `follower-${idx}`}
                            follower={follower}
                            feed={feed}
                            user={user}
                            viewer={viewer}
                            onRemoveFollower={removeFollower}
                            onToggleAdmin={toggleAdminStatus}
                            onToggleModerator={toggleModeratorStatus}
                            onTransferOwnership={transferOwnership}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FeedFollowers;