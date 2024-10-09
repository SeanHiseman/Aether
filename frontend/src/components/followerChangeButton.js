import axios from "axios";
import React, { useEffect, useState } from "react"

const FollowerChangeButton = ({ feedId, followerId, isFollower, isRequestSent, type }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [follower, setFollower] = useState(isFollower);
    const [request, setRequest] = useState(isRequestSent);

    //Update follower state, including requests for private feeds
    useEffect(() => {
        setRequest(isRequestSent);
        setFollower(isFollower);
    }, [isRequestSent, isFollower]);

    const handleFollowerChange = async () => {
        try {
            if (type === 'private' && !follower && !request) {
                await axios.post('/api/send_follow_request', { receiverId: feedId, senderId: followerId });
                setRequest(true);
            } else if (type === 'Private' && request) {
                await axios.delete('/api/cancel_follow_request', { data: { followerId, feedId } });
                setRequest(false);
            } else {
                //Public feeds can be freely followed/unfollowed
                const url = follower ? 'unfollow_feed' : 'follow_feed';
                await axios.post(`/api/${url}`, { followerId, feedId });
                setFollower(!follower);
            }
        } catch (error) {
            setErrorMessage("Error updating following");
        }
    };
    
    const buttonText = follower ? 'Unfollow' : request && type === 'Private' ? 'Cancel request' : 'Follow';

    return (
        <div>
            <button className="button" onClick={handleFollowerChange}>
                {buttonText}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default FollowerChangeButton;