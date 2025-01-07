import axios from 'axios';
import { FaUserMinus, FaUserPlus } from 'react-icons/fa';
import React, { useState } from 'react';

const ManageConnectionButton = ({ connectRequest, feed, isConnected, viewerId, onRequestUpdate }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [hasConnection, setHasConnection] = useState(isConnected || feed.isConnected);
    const [request, setRequest] = useState(connectRequest || feed.connectRequest);
    const senderId = request?.sender_id || viewerId;
    const receiverId = request?.receiver_id || feed?.feed_id;

    const handleSendRequest = async () => {
        try {
            let method, requestData, url;
            if (hasConnection) {
                method = 'delete';
                url = '/api/delete_connection';
                requestData = { deleterId: viewerId, feedId: (viewerId === senderId ? receiverId : senderId) };
            } 
            else if (request) {
                if (viewerId === senderId) {
                    method = 'delete';
                    url = '/api/delete_connect_request';
                    requestData = { receiverId, senderId: viewerId };
                } else {
                    method = 'delete';
                    url = '/api/delete_connect_request';
                    requestData = { receiverId: viewerId, senderId };
                }
            } 
            else {
                method = 'post';
                url = '/api/send_connect_request';
                requestData = { receiverId, senderId: viewerId };
            }
            const response = await axios({ method, url, data: requestData });
            if (response.status === 200) {
                if (method === 'delete') {
                    setHasConnection(false);
                    setRequest(false);
                    onRequestUpdate(feed.feed_id);
                } else {
                    setRequest(true);
                    setHasConnection(false);
                }
            } else {
                setErrorMessage("Connection handling error");
            }
        } catch (error) {
            setErrorMessage("Connection handling error");
        }
    };

    const handleConnectRequest = async (result) => {
        try {
            let response;
            if (result === 'accept') {
                response = await axios.post('/api/accept_connect_request', { receiverId: viewerId, senderId });
            } else if (result === 'reject') {
                response = await axios.delete('/api/delete_connect_request', { data: { receiverId: viewerId, senderId } });
            }
            if (response.status === 200) {
                if (request && typeof onRequestUpdate === 'function') {
                    onRequestUpdate(request.sender_id);
                } else {
                    setRequest(false);
                    setHasConnection(result === 'accept');
                }
            }
        } catch (error) {
            setErrorMessage("Error handling request");
        }
    };    

    if ((viewerId === receiverId) && request && !hasConnection) {
        return (
            <div>
                <button className="small-icon" onClick={() => handleConnectRequest('accept')}>
                    <FaUserPlus /><p className="icon-text">Accept</p>
                </button>
                <button className="small-icon" onClick={() => handleConnectRequest('reject')}>
                    <FaUserMinus /><p className="icon-text">Reject</p>
                </button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        );
    }
    return (
        <div>
            <button className="small-icon" onClick={handleSendRequest}>
            {hasConnection ? (
                <>
                    <FaUserMinus /><p className="icon-text">Disconnect</p>
                </>
            ) : request ? (
                <>
                    <FaUserMinus /><p className="icon-text">Cancel request</p>
                </>
            ) : (
                <>
                    <FaUserPlus /><p className="icon-text">Connect</p>
                </>
            )}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    );
}

export default ManageConnectionButton;

