import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const FriendRequests = ({ profile }) => {
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
            setErrorMessage('Error fetching friend requests:', error);
        } 
    };

    const handleFriendRequest = async (request, result) => {
        try {
            if (result === 'Accept') {
                await axios.post('/api/accept_friend_request', { request });
                setFriendRequests(prevRequests => prevRequests.filter(req => req.request_id !== request.request_id));
            } else if (result === 'Reject') {
                await axios.delete('/api/reject_friend_request', { data: { request } });
                setFriendRequests(prevRequests => prevRequests.filter(req => req.request_id !== request.request_id));
            }
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
                    {friendRequests.map((request, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="friend-link" to={`/profile/${request.sender.username}`}>
                                    <img className="large-profile-photo" src={`/${request.sender.profile.profile_photo}`} alt="Profile" />
                                    <p className="large-text profile-name">{request.sender.username}</p>
                                </Link>
                                <button className="button" onClick={() => handleFriendRequest(request, 'Accept')}>
                                    Accept friend request
                                </button>
                                <button className="button" onClick={() => handleFriendRequest(request, 'Reject')}>
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