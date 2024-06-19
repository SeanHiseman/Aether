import axios from "axios";
import React, { useState } from "react"

const FollowerChangeButton = ({ userId, receiverUserId, profileId, isFollowing, isPrivate, onFollowerChange }) => {
    const [errorMessage, setErrorMessage] = useState('');

    const handleFollowerChange = () => {
        //Depends on if user is already following the profile
        const url = isFollowing ? 'remove_follower' : 'follow_profile';
        axios.post(`/api/${url}`, { userId, profileId })
            .then(() => {
                onFollowerChange(!isFollowing);
            }).catch(error => {
                setErrorMessage("Error changing following", error);
            });
    };

    //Private profiles don't have followers
    if (isPrivate) {
        return;
        //If user is viewing their own profile
    } else if (userId == receiverUserId) {
        return;
    } else {
        return (
            <div>
                <button className="button" onClick={handleFollowerChange}>
                    {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        )
    }
}

export default FollowerChangeButton;