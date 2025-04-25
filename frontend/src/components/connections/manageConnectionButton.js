import axios from 'axios';
import { FaUserMinus, FaUserPlus } from 'react-icons/fa';
import React, { useEffect, useState } from 'react';

const ManageConnectionButton = ({ connectRequest, feed, isConnected, viewerId, onRequestUpdate }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [hasConnection, setHasConnection] = useState(isConnected || feed.isConnected);
    const [request, setRequest] = useState(connectRequest || feed.connectRequest);
    const senderId = request?.sender_id || viewerId;
    const receiverId = request?.receiver_id || feed?.feed_id;

    useEffect(() => {
        setHasConnection(isConnected || feed.isConnected)
        setRequest(connectRequest || feed.connectRequest);
    }, [connectRequest, feed.connectRequest, isConnected, feed.isConnected]);

    const handleConnectRequest = async (result) => {
        try {
            let response;
            if (result === 'accept') {
                response = await axios.post('/api/accept_connect_request', {
                    receiverId: viewerId,
                    senderId
                });
                if (response.status === 200) {
                    const newConnection = {
                        feed_id: senderId,
                        feed_name: feed.feed_name,
                        feed_photo: feed.feed_photo,
                    };
                    setHasConnection(true);
                    setRequest(null);
                    if (onRequestUpdate) {
                        onRequestUpdate(newConnection, senderId);
                    }
                }
            } else if (result === 'reject') {
                response = await axios.delete('/api/delete_connect_request', {
                    data: { receiverId: viewerId, senderId }
                });
                if (response.status === 200) {
                    setRequest(null);
                    if (onRequestUpdate) {
                        onRequestUpdate(null, senderId);
                    }
                }
            }
        } catch (error) {
            setErrorMessage("Error handling request");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }; 

    const handleSendRequest = async () => {
        try {
            let method, requestData, url;
            const targetFeedId = viewerId === senderId ? receiverId : senderId;
            if (hasConnection) {
                if (window.confirm(`Are you sure you want to delete your connection with ${feed.feed_name}`)) {
                    method = 'delete';
                    url = '/api/delete_connection';
                    requestData = { deleterId: viewerId, feedId: targetFeedId };
                }
            } 
            else if (request) {
                method = 'delete';
                url = '/api/delete_connect_request';
                requestData = { 
                    receiverId: viewerId === senderId ? receiverId : viewerId, 
                    senderId: viewerId === senderId ? viewerId : senderId 
                };
            } 
            else {
                method = 'post';
                url = '/api/send_connect_request';
                requestData = { receiverId, senderId: viewerId };
            }
            const response = await axios({ 
                method, 
                url, 
                data: requestData 
            });
            if (response.status === 200) {
                if (method === 'delete') {
                    setHasConnection(false);
                    setRequest(null);
                    if (onRequestUpdate) {
                        onRequestUpdate(targetFeedId);
                    }
                } else {
                    setRequest(true);
                    setHasConnection(false);
                }
            }
        } catch (error) {
            setErrorMessage("Connection handling error");
            setTimeout(() => { setErrorMessage(''); }, 5000);
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