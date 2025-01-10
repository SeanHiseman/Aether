import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ManageConnectionButton from './manageConnectionButton';

const ConnectRequests = ({ feed, onConnectionAdded }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [connectRequests, setConnectRequests] = useState([]);

    useEffect(() => {
        const getConnectRequests = async () => {
            try {
                const response = await axios.get(`/api/get_connect_requests/${feed.feed_id}`);
                setConnectRequests(response.data.requests || []);
            } catch (error) {
                setErrorMessage('Error getting requests');
            } 
        };
        getConnectRequests();
    }, [feed.feed_id]); 

    const handleRequestUpdate = (newConnection, senderId) => {
        setConnectRequests(prevRequests => 
            prevRequests.filter(request => request.sender_id !== senderId)
        ); 
        if (newConnection) {
            onConnectionAdded(newConnection);
        }
    };

    return (
        <><div className="error-message">{errorMessage}</div>
        {connectRequests.length === 0 ? (
            <p>No pending connect requests</p>
        ) : (
            <ul className="content-list">
                {connectRequests.map((request, index) => (
                    <li key={index}>
                        <div className="result-widget">
                            <Link className="feed-link" to={`/u/${request.sender.feed_name}`}>
                                <img className="large-feed-photo" src={`/${request.sender.feed_photo}`} alt="Profile" />
                                <p className="text36 feed-name">{request.sender.feed_name}</p>
                            </Link>
                            <ManageConnectionButton 
                                connectRequest={request} 
                                feed={request.sender} 
                                isConnected={false} 
                                viewerId={feed.feed_id} 
                                onRequestUpdate={handleRequestUpdate} 
                            />
                        </div>
                    </li>
                ))}
            </ul>
        )}</>
    );
};

export default ConnectRequests;