import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const FollowRequests = ({ feed }) => {
    const [errorMessage, setErrorMessage] = useState('');
    //const [nestRequests, setNestRequests] = useState(null);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        getFollowRequests();
    }, []);

    const getFollowRequests = async () => {
        try {
            const response = await axios.get(`/api/follow_requests/${feed.feed_id}`);
            console.log("response.data.requests:", response.data.requests);
            setRequests(response.data.requests);
            //const nestResponse = await axios.get(`/api/group_nest_requests/${groupDetails.groupId}`);
            //setNestRequests(nestResponse.data);
        } catch (error) {
            setErrorMessage('Error getting requests');
        }
    };

    const handleRequestAction = async (request, result) => {
        try {
            if (result === 'accept') {
                await axios.post('/api/accept_follow_request', { request });
            } else if (result === 'reject') {
                await axios.delete('/api/delete_follow_request', { data: { senderId: request.sender_id, receiverId: feed.feed_id } });
            }
            setRequests((prevRequests) => prevRequests.filter((prevRequest) => prevRequest.request_id !== request.request_id));
        } catch (error) {
            setErrorMessage('Error handling request');
        }
    };

    //Accepts or rejects join request
    const handleNestRequest = async (action, requestId, senderId) => {
        try {
            if (action === 'accept') {
                await axios.post('/api/accept_nest_request', {
                    feedId: feed.feed_id, 
                    requestId,
                    senderId,
                });
            } else if (action === 'reject') {
                await axios.delete('/api/reject_nest_request', { 
                    data: { requestId }
                });
            }
            getFollowRequests();
        } catch (error) {
            setErrorMessage('Error handling request');
        }
    }; 

    return (
        <div className="channel-content">
            <h2>Follow Requests</h2>
            {requests.length === 0 ? (
                <p>No pending requests</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {requests.map((request, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="feed-link" to={`/u/${request.sender.feed_name}`}>
                                    <img className="large-feed-photo" src={`/${request.sender.feed_photo}`} alt="Profile" />
                                    <p className="text36 feed-name">{request.sender.feed_name}</p>
                                </Link>
                                <button className="button" onClick={() => handleRequestAction(request, 'accept')}>
                                    Accept
                                </button>
                                <button className="button" onClick={() => handleRequestAction(request, 'reject')}>
                                    Reject
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                /*<ul>
                    <p>Group feeds</p>
                    {nestRequests.map((request) => (
                        <li key={request.request_id}>
                            {request.sender.groupName}
                            <button className="button" onClick={() => handleNestRequest("accept", request.request_id, request.sender_id)}>
                                Accept
                            </button>
                            <button className="button" onClick={() => handleNestRequest("reject", request.request_id)}>
                                Reject
                            </button>
                        </li>
                    ))}
                </ul>*/
            )}
        </div>
    );
};

export default FollowRequests;