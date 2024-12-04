import axios from "axios";
import React, { useEffect, useState } from "react"

const FollowerChangeButton = ({ feed, viewerId }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [follower, setFollower] = useState(feed.isFollower);
    const [followerCount, setFollowerCount] = useState(feed.follower_count);
    const [request, setRequest] = useState(feed.hasFollowRequest);
    const isPrivate = feed.type === 'private';

    //Update follower state, including requests for private feeds
    useEffect(() => {
        setRequest(feed.hasFollowRequest);
        setFollower(feed.isFollower);
        setFollowerCount(feed.follower_count);
    }, [feed.hasFollowRequest, feed.isFollower, feed.follower_count]);

    const handleFollowerChange = async () => {
        try {
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
    
    const buttonText = follower ? 'Unfollow' : request && isPrivate ? 'Cancel request' : 'Follow';

    return (
        <div>
            <button className="button" onClick={handleFollowerChange}>
                {buttonText}
            </button>
            <p>{followerCount} {followerCount === 1 ? 'follower' : 'followers'}</p>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default FollowerChangeButton;