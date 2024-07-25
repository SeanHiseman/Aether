import axios from "axios";
import React, { useEffect, useState } from "react"

const FollowerChangeButton = ({ userId, profileId, isFollowing }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [status, setStatus] = useState(isFollowing); //Initial following status
    
    useEffect(() => {
        setStatus(isFollowing);
    }, [isFollowing]);

    const handleFollowerChange = async () => {
        const newStatus = !status;
        //Depends on if user is already following the profile
        const url = status ? 'remove_follower' : 'follow_profile';

        try {
            axios.post(`/api/${url}`, { userId, profileId }); 
            setStatus(newStatus);
        } catch {
            setErrorMessage("Error changing following");
        };
    };

    return (
        <div>
            <button className="button" onClick={handleFollowerChange}>
                {status ? 'Unfollow' : 'Follow'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default FollowerChangeButton;