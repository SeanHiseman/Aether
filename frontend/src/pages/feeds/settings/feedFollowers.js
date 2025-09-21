import axios from 'axios';
import { useCallback, useEffect, useState, useContext } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AuthContext } from '../../../components/authContext';
import { FaCrown, FaMinus, FaMinusCircle, FaPlusCircle } from 'react-icons/fa';
import { FormatNumber } from '../../../functions/formatNumber';

function chunkFollowersToQuads(followers) {
    const quads = [];
    for (let i = 0; i < followers.length; i += 4) {
        quads.push(followers.slice(i, i + 4));
    }
    return quads;
}

const FollowerWidget = ({ follower, feed, user, viewer, onRemoveFollower, onToggleAdmin, onToggleModerator, onTransferOwnership }) => {
    const imageUrl = follower?.followerFeed?.feed_photo
        ? `/${follower?.followerFeed?.feed_photo}`
        : "/media/site_images/blank-profile.png";

    let role = "Follower";
    if (follower?.is_mod) role = "Moderator";
    if (follower?.is_admin) role = "Admin";
    if (follower?.followerFeed?.feed_owner === feed?.feed_owner) role = "Leader";

    return (
        <div className="explore-block bg-gray-800 rounded-lg flex flex-col items-center p-4">
            <Link 
                to={`/u/${follower?.followerFeed?.feed_name}`} 
                className="w-20 h-20 rounded-full overflow-hidden mb-2"
            >
                <img 
                    className="w-full h-full object-cover feed-img" 
                    src={imageUrl} 
                    onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} 
                    alt="Feed"
                />
            </Link>
            
            <p className="text-lg font-bold text-white truncate mt-1 text-center">
                {follower?.followerFeed?.feed_name}
            </p>
            
            {feed?.is_group && (
                <p className="text-sm text-gray-300 mb-2">{role}</p>
            )}

            {/* Action buttons - only show if not the current user */}
            {user?.user_id !== follower?.follower_id && (
                <div className="flex flex-col gap-1 mt-2 w-full">
                    {/* Admins can make/remove moderators, except the owner */}
                    {feed?.isAdmin && !follower?.is_admin && feed?.is_group && (
                        <button className="small-icon" onClick={() => onToggleModerator(follower)}>
                            {follower.is_mod ? <FaMinusCircle /> : <FaPlusCircle />}
                            <p className="icon-text">{follower?.is_mod ? 'Remove as moderator' : 'Make moderator'}</p>
                        </button>
                    )}
                    {/* Feed owner can see and change admin status */}
                    {feed?.isAdmin && follower?.followerFeed?.feed_owner !== feed?.feed_owner && feed?.is_group && (
                        <button className="small-icon" onClick={() => onToggleAdmin(follower)}>
                            {follower?.is_admin ? <FaMinusCircle /> : <FaPlusCircle />}
                            <p className="icon-text">{follower?.is_admin ? 'Remove as admin' : 'Make admin'}</p>
                        </button>
                    )}
                    {/* Feed owner can transfer ownership, but not to themselves */}
                    {feed?.isOwner && follower?.is_admin && follower?.followerFeed?.feed_owner !== feed?.feed_owner && feed?.is_group && (
                        <button className="small-icon" onClick={() => onTransferOwnership(follower)}>
                            <FaCrown />
                            <p className="icon-text">Make Feed Owner</p>
                        </button>
                    )}
                    {/* Moderators can remove regular followers but not other moderators/admins */}
                    {(feed?.isMod && !follower?.is_admin && !follower?.is_mod) && (
                        <button className="small-icon" onClick={() => onRemoveFollower(follower)}>
                            <FaMinus />
                            <p className="icon-text">Remove follower</p>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

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

    //Chunk followers into groups of 4
    const followerQuads = chunkFollowersToQuads(followers);

    return (
        <div className="channel-content">
            <div className="followers-header">
                <p className="large-text">{FormatNumber(followerCount)} {followerCount === 1 ? 'follower' : 'followers'}</p>
                {feed?.is_group && <p className="small-text">Moderators remove content and followers</p>}
                {feed?.is_group && <p className="small-text">Admins remove content, appoint and dismiss mods, and make feed changes</p>}
            </div>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            {followers.length === 0 ? (
                <p className="medium-text faded-text">No followers</p>
            ) : (
                <div className="flex flex-col gap-3 w-full">
                    {followerQuads.map((followerQuad, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-3 w-full">
                            {followerQuad.map((follower, followerIdx) => (
                                <FollowerWidget
                                    key={follower?.follower_id || `follower-${idx}-${followerIdx}`}
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
                    ))}
                </div>
            )}
        </div>
    );
};

export default FeedFollowers;