import axios from 'axios';
import { AuthContext } from '../../../components/authContext';
import { FormatNumber } from '../../../functions/formatNumber';
import ConfirmModal from '../../../components/modals/confirmModal';
import FollowerWidget from './followerWidget';
import { useCallback, useEffect, useState, useContext } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';

const FeedFollowers = () => {
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Confirm');
    const [confirmAction, setConfirmAction] = useState(() => () => {})
    const [errorMessage, setErrorMessage] = useState('');
    const [followers, setFollowers] = useState([]);
    const { feed, setFeed } = useOutletContext();
    const [followerCount, setFollowerCount] = useState(feed?.follower_count || 0);
    const navigate = useNavigate();
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const urlPrefix = feed?.is_group ? 'g' : 'u';
    const { user, viewer } = useContext(AuthContext);

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
        try {
            if (follower?.follower_id === viewer?.feed_id && follower?.is_admin) {
                setConfirmTitle('Remove Admin Privileges');
                setConfirmMessage('Are you sure you want to remove yourself as an admin? You will lose admin privileges.');
                setConfirmAction(() => async () => {
                    try {
                        await axios.post('/api/toggle_admin', {
                            feedId: feed?.feed_id,
                            followerId: follower?.follower_id,
                            isAdmin: !follower?.is_admin,
                        });
                        setFollowers((prev) =>
                            prev.map((f) =>
                                f?.follower_id === follower?.follower_id ? { ...f, is_admin: !f?.is_admin } : f
                            )
                        );
                        navigate(`/${urlPrefix}/${feed?.feed_name}/Main`);
                    } catch (error) {
                        setErrorMessage(error.response.data?.message || "Error removing admin status");
                        setTimeout(() => { setErrorMessage(''); }, 5000);
                    }
                });
                setShowConfirmModal(true);
                return;
            }
            await axios.post('/api/toggle_admin', {
                feedId: feed?.feed_id,
                followerId: follower?.follower_id,
                isAdmin: !follower?.is_admin,
            });
            setFollowers((prev) =>
                prev.map((f) =>
                    f?.follower_id === follower?.follower_id ? { ...f, is_admin: !f?.is_admin } : f
                )
            );
        } catch (error) {
            setErrorMessage(error.response.data?.message || "Error toggling admin status");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    //Mods can't appoint/dismiss other mods or admins, so no need to check if removing own
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
        setConfirmTitle('Transfer Ownership');
        setConfirmMessage('Are you sure you want to transfer ownership? This action cannot be undone.');
        setConfirmAction(() => async () => {
            const response = await axios.post('/api/transfer_ownership', {
                feedId: feed?.feed_id,
                newOwnerId: follower?.followerFeed?.feed_owner,
            });
            if (response?.status === 200) {
                setFeed((prevFeed) => ({ ...prevFeed, feed_owner: follower?.follower_id }));
            }
        });
        setShowConfirmModal(true);
        return;
    };

    const confirmDelete = async () => {
        await confirmAction();
        setShowConfirmModal(false);
    };

    const cancelDelete = () => {
        setShowConfirmModal(false);
    };

    return (
        <><div className="channel-content">
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
                            onTransferOwnership={transferOwnership} />
                    ))}
                </div>
            )}
        </div>
        <ConfirmModal isOpen={showConfirmModal} onConfirm={confirmDelete} onCancel={cancelDelete} title={confirmTitle} message={confirmMessage}/></>
    );
};

export default FeedFollowers;