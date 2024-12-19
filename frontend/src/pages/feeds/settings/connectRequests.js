import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ManageConnectionButton from '../../../components/manageConnectionButton';

const ConnectRequests = ({ feed }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [connectRequests, setConnectRequests] = useState([]);

    useEffect(() => {
        const getConnectRequests = async () => {
            try {
                const response = await axios.get(`/api/get_connect_requests/${feed.feed_id}`);
                console.log("response.data:", response.data);
                setConnectRequests(response.data.requests || []);
            } catch (error) {
                setErrorMessage('Error getting requests');
            } 
        };
        getConnectRequests();
    }, [feed.feed_id]); 

    const handleRequestUpdate = (senderId) => {
        setConnectRequests(prevRequests => 
            prevRequests.filter(request => request.sender_id !== senderId)
        );
    };

    return (
        <div className="channel-content">
            <h2>Connect Requests</h2>
            {connectRequests.length === 0 ? (
                <p>No pending requests</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {connectRequests.map((request, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="feed-link" to={`/u/${request.sender.feed_name}`}>
                                    <img className="large-feed-photo" src={`/${request.sender.feed_photo}`} alt="Profile" />
                                    <p className="text36 feed-name">{request.sender.feed_name}</p>
                                </Link>
                                <ManageConnectionButton connectRequest={request} feed={feed} isConnected={false} viewerId={feed.feed_id} onRequestUpdate={handleRequestUpdate} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div> 
    );
};

export default ConnectRequests;