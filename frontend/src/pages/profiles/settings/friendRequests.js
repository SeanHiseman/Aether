import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const FriendRequests = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [friendRequests, setFriendRequests] = useState([]);

    useEffect(() => {
        getFriendRequests();
    }, []);

    const getFriendRequests = async () => {
        try {
            const response = await axios.get('/api/get_friend_requests');
            setFriendRequests(response.data);
        } catch (error) {
            setErrorMessage('Error getting requests');
        } 
    };

    const handleFriendRequest = async (request, result) => {
        try {
            if (result === 'accept') {
                await axios.post('/api/accept_friend_request', { request });
            } else if (result === 'reject') {
                await axios.delete('/api/reject_friend_request', { data: { request } });
            }
            getFriendRequests();
        } catch (error) {
            setErrorMessage("Error handling request:", error);
        }
    };

    return (
        <div className="channel-content">
            <h2>Friend Requests</h2>
            {friendRequests.length === 0 ? (
                <p>No pending requests</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {friendRequests.map((request, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="profile-link" to={`/profile/${request.sender.username}`}>
                                    <img className="large-profile-photo" src={`/${request.sender.profile.profile_photo}`} alt="Profile" />
                                    <p className="large-text profile-name">{request.sender.username}</p>
                                </Link>
                                <button className="button" onClick={() => handleFriendRequest(request, 'accept')}>
                                    Accept friend request
                                </button>
                                <button className="button" onClick={() => handleFriendRequest(request, 'reject')}>
                                    Reject friend request
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div> 
    );
};

export default FriendRequests;