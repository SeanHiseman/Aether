import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const MemberJoinRequests = ({ group }) => {
    const [errorMessage, setErrorMessage] = useState('');
    //const [nestRequests, setNestRequests] = useState(null);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        getJoinRequests();
    }, []);

    //Gets requests to join a group if it is a private group
    const getJoinRequests = async () => {
        try {
            const response = await axios.get(`/api/group_requests/${group.groupId}`);
            setRequests(response.data);
            //const nestResponse = await axios.get(`/api/group_nest_requests/${groupDetails.groupId}`);
            //setNestRequests(nestResponse.data);
        } catch (error) {
            setErrorMessage('Error getting requests');
        }
    };

    //Accepts or rejects join request
    const handleRequestAction = async (request, result) => {
        try {
            if (result === 'accept') {
                await axios.post('/api/accept_join_request', { request });
            } else if (result === 'reject') {
                await axios.delete('/api/reject_group_request', { data: { request } });
            }
            getJoinRequests();
        } catch (error) {
            setErrorMessage('Error handling request');
        }
    };

    //Accepts or rejects join request
    const handleNestRequest = async (action, requestId, senderId) => {
        try {
            if (action === 'accept') {
                await axios.post('/api/accept_nest_request', {
                    groupId: group.groupId, 
                    requestId,
                    senderId,
                });
            } else if (action === 'reject') {
                await axios.delete('/api/reject_nest_request', { 
                    data: { requestId: requestId }
                });
            }
            getJoinRequests();
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
                                <Link className="profile-link" to={`/profile/${request.sender.username}`}>
                                    <img className="large-profile-photo" src={`/${request.sender.profile.profile_photo}`} alt="Profile" />
                                    <p className="large-text profile-name">{request.sender.username}</p>
                                </Link>
                                <button className="button" onClick={() => handleRequestAction(request, 'accept')}>
                                    Accept follow request
                                </button>
                                <button className="button" onClick={() => handleRequestAction(request, 'reject')}>
                                    Reject follow request
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

export default MemberJoinRequests;