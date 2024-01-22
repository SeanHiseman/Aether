import React, { useState, useEffect } from 'react';
import '../css/profile.css';

function FriendRequests() {
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        fetch(`/get_friend_requests`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => setRequests(data))
            .catch(error => {
                console.log('There was a problem fetching the friend request: ', error.message);
            });
    }, []);

    const handleAccept = (requestId) => {
        fetch(`/accept_friend_request/${requestId}`, { method: 'PUT' })
            .then(() => {
                //Remove accepted request from list
                setRequests(requests.filter(req => req.request_id !== requestId));
            });
    };

    const handleReject = (requestId) => {
        fetch(`/reject_friend_request/${requestId}`, { method: 'DELETE' })
            .then(() => {
                // Remove rejected request from list
                setRequests(requests.filter(req => req.request_id !== requestId));
            });
    };
    return (
        <div>
            <h3>Incoming Friend Requests</h3>
            {requests.map(request => (
                <div class="friend-request-button-container" key={request.request_id}>
                    <p>Request from: {request.senderName}</p>
                    <button class="small-button" onClick={() => handleAccept(request.request_id)}>Accept</button>
                    <button class="small-button" onClick={() => handleReject(request.request_id)}>Reject</button>
                </div>
            ))}
        </div>
    );
}

export default FriendRequests;
