import api from '../api';
import ConfirmModal from './modals/confirmModal';
import { FaMinus, FaMinusCircle, FaPlusCircle } from 'react-icons/fa';
import { FormatNumber } from '../functions/formatNumber';
import { useEffect, useState } from 'react';

const FollowerChangeButton = ({ feed, showFollowers = true, showName, showVertical, updateFeeds, viewerId }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [follower, setFollower] = useState(feed?.isFollower);
    const [followerCount, setFollowerCount] = useState(feed?.follower_count);
    const [request, setRequest] = useState(feed?.followRequest);
    const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
    const isAdminOrMod = feed?.isAdmin || feed?.isMod;
    const isPrivate = feed?.type === 'private';

    useEffect(() => {
        setRequest(feed?.followRequest);
        setFollower(feed?.isFollower);
        setFollowerCount(feed?.follower_count);
    }, [feed, feed?.hasFollowRequest, feed?.isFollower, feed?.follower_count]);

    const handleFollowerChange = async () => {
        try {
            if (follower && isAdminOrMod && !showUnfollowConfirm) {
                setShowUnfollowConfirm(true);
                return;
            }
            if (isPrivate && !follower && !request) {
                await api.post('/send_follow_request', { receiverId: feed?.feed_id, senderId: viewerId });
                setRequest(true);
            } else if (isPrivate && request) {
                await api.delete('/delete_follow_request', { data: { receiverId: feed?.feed_id, senderId: viewerId } });
                setRequest(false);
            } else {
                const url = follower ? 'unfollow_feed' : 'follow_feed';
                await api.post(`/${url}`, { followerId: viewerId, followedFeedId: feed?.feed_id });
                const newFollowerState = !follower;
                setFollower(newFollowerState);
                setFollowerCount(prev => newFollowerState ? prev + 1 : prev - 1);
                const cached = localStorage.getItem("followedFeeds");
                let followed = cached ? JSON.parse(cached) : [];
                if (newFollowerState) {
                    if (!followed.some(f => f.feed_id === feed.feed_id)) {
                        const { isFollower, followRequest, follower_count, ...cleanFeed } = feed;
                        followed.push(cleanFeed); 
                    }
                } else {
                    followed = followed.filter(f => f.feed_id !== feed.feed_id);
                }
                localStorage.setItem("followedFeeds", JSON.stringify(followed));
                if (updateFeeds) {
                    updateFeeds();
                }
            }
            setShowUnfollowConfirm(false);
        } catch (error) {
            setErrorMessage(error.response.data?.message || "Error updating following");
            setTimeout(() => setErrorMessage(''), 5000);
        }
    };

    return (
        <><div className={showVertical ? "follow-container vertical" : "follow-container horizontal"}>
            {showName && <p className="font-bold text-white text-lg truncate">{feed.feed_name}</p>}
            {showFollowers && <p className="small-text">{FormatNumber(followerCount)} {followerCount === 1 ? 'follower' : 'followers'}</p>}
            <button className="follow-button" onClick={handleFollowerChange}>
                {follower ? <FaMinusCircle /> : request && isPrivate ? <FaMinus /> : <FaPlusCircle />}
                <p className="icon-text">
                    {follower
                        ? 'Unfollow'
                        : isPrivate
                            ? request
                                ? 'Cancel request'
                                : 'Follow request'
                            : 'Follow'}
                </p>
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
        <ConfirmModal
            isOpen={showUnfollowConfirm}
            onConfirm={() => {
                setShowUnfollowConfirm(false);
                handleFollowerChange();
            } }
            onCancel={() => setShowUnfollowConfirm(false)}
            title="Unfollow Confirmation"
            message={`You are ${feed?.isAdmin ? 'an admin' : 'a moderator'} of this feed. Are you sure you want to unfollow?`} />
        </>
    )
}

export default FollowerChangeButton;