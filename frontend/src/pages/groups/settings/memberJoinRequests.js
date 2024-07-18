import axios from 'axios';
import React, { useState } from 'react';

const MemberJoinRequests = ({ group }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [nestRequests, setNestRequests] = useState(null);
    const [requests, setRequests] = useState([]);

    //Gets requests to join a group if it is a private group
    const getJoinRequests = async () => {
        try {
            const response = await axios.get(`/api/group_requests/${group.groupId}`);
            setRequests(response.data);
            //const nestResponse = await axios.get(`/api/group_nest_requests/${groupDetails.groupId}`);
            //setNestRequests(nestResponse.data);
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
    };

    //Accepts or rejects join request
    const handleRequestAction = async (action, requestId, senderId) => {
        try {
            if (action === 'accept') {
                await axios.post('/api/accept_join_request', {
                    groupId: group.groupId, 
                    requestId,
                    senderId,
                });
            } else if (action === 'reject') {
                await axios.delete('/api/reject_group_request', { 
                    data: { requestId: requestId }
                });
            }
            getJoinRequests();
        } catch (error) {
            setErrorMessage('Error handling request:', error);
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
            setErrorMessage('Error handling request:', error);
        }
    }; 

    return (
        <div>
            <h2>Join Requests</h2>
            {requests.length === 0 ? (
                <p>No pending requests</p>
            ) : (
                <div>
                    <ul>
                        <p>Users</p>
                        {requests.map((request) => (
                            <li key={request.request_id}>
                                {request.sender.username}
                                <button className="button" onClick={() => handleRequestAction("accept", request.request_id, request.sender_id)}>
                                    Accept
                                </button>
                                <button className="button" onClick={() => handleRequestAction("reject", request.request_id)}>
                                    Reject
                                </button>
                            </li>
                        ))}
                    </ul>
                    <ul>
                        <p>Groups</p>
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
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MemberJoinRequests;