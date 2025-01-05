import axios from 'axios';
import { FaHeart, FaHeartBroken, FaMinusCircle } from 'react-icons/fa';
import React, { useEffect, useState } from 'react';
//import Tooltip from '@mui/material/Tooltip';

const FollowerChangeButton = ({ feed, viewerId }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [follower, setFollower] = useState(feed.isFollower);
    const [followerCount, setFollowerCount] = useState(feed.follower_count);
    const [request, setRequest] = useState(feed.followRequest);
    const isPrivate = feed.type === 'private';

    //Update follower state, including requests for private feeds
    useEffect(() => {
        setRequest(feed.followRequest);
        setFollower(feed.isFollower);
        setFollowerCount(feed.follower_count);
    }, [feed.hasFollowRequest, feed.isFollower, feed.follower_count]);

    const handleFollowerChange = async () => {
        try {
            if (follower && (feed.isAdmin || feed.isMod)) {
                const confirmUnfollow = window.confirm(
                    "You are about to unfollow this feed. You will lose your admin/mod status. Are you sure you want to proceed?"
                );
                if (!confirmUnfollow) {
                    return;
                }
            }
            if (isPrivate && !follower && !request) {
                await axios.post('/api/send_follow_request', { receiverId: feed.feed_id, senderId: viewerId });
                setRequest(true);
            } else if (isPrivate && request) {
                await axios.delete('/api/delete_follow_request', { data: { receiverId: feed.feed_id, senderId: viewerId } });
                setRequest(false);
            } else {
                //Public feeds can be freely followed/unfollowed
                const url = follower ? 'unfollow_feed' : 'follow_feed';
                await axios.post(`/api/${url}`, { followerId: viewerId, feedId: feed.feed_id });
                const newFollowerState = !follower;
                setFollower(newFollowerState);
                setFollowerCount(prevCount => newFollowerState ? prevCount + 1 : prevCount - 1);
            }
        } catch (error) {
            setErrorMessage("Error updating following");
        }
    };
    
    //const toolTipText = follower ? 'Unfollow' : request && isPrivate ? 'Cancel request' : 'Follow';

    return (
        <div>
            {/*<Tooltip placement="bottom" title={toolTipText}>*/}
                <button className="small-icon" onClick={handleFollowerChange}>
                    {follower ? <FaHeartBroken /> : request && isPrivate ? <FaMinusCircle /> : <FaHeart />}
                    <p className="icon-text">{followerCount} {followerCount === 1 ? 'follower' : 'followers'}</p>
                </button>
            {/*</Tooltip>*/}
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default FollowerChangeButton;