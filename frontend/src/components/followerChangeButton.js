import axios from "axios";
import React, { useEffect, useState } from "react"

const FollowerChangeButton = ({ userId, profileId, isFollowing }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [following, setFollowing] = useState(isFollowing);

    //Update following state
    useEffect(() => {
        setFollowing(isFollowing);
    }, [isFollowing]);

    const handleFollowerChange = () => {
        //Depends on if user is already following the profile
        const url = following ? 'remove_follower' : 'follow_profile';
        axios.post(`/api/${url}`, { userId, profileId })
            .then(() => {
                setFollowing(!following);
            }).catch(error => {
                setErrorMessage("Error changing following", error);
            });
    };

    return (
        <div>
            <button className="button" onClick={handleFollowerChange}>
                {following ? 'Unfollow' : 'Follow'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default FollowerChangeButton;