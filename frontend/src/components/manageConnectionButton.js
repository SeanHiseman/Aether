import axios from "axios";
import React, { useEffect, useState } from "react"

const ManageConnectionButton = ({ connectRequest, feed, isConnected, viewerId, onRequestUpdate }) => {
    console.log("connectRequest:", connectRequest);
    console.log("feed:", feed);
    console.log("isConnnected:", isConnected);
    console.log("viewerId:", viewerId);
    const [errorMessage, setErrorMessage] = useState('');
    const [hasConnection, setHasConnection] = useState(isConnected || feed?.isConnected);
    const [request, setRequest] = useState(connectRequest || feed?.connectRequest);
    const senderId = connectRequest?.sender_id || viewerId;
    const receiverId = connectRequest?.receiver_id || feed?.feed_id;

    useEffect(() => {
        setRequest(connectRequest || feed?.connectRequest);
        setHasConnection(isConnected || feed?.isConnected);
    }, [connectRequest, feed?.connectRequest, isConnected, feed?.isConnected]);

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
                } else {
                    setRequest(true);
                    setHasConnection(false);
                }
            } else {
                setErrorMessage("Connect request error");
            }
        } catch (error) {
            console.log("error:", error);
            setErrorMessage("Connect request error");
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
            console.log("response.status:", response.status);
            if (response.status === 200) {
                if (connectRequest && typeof onRequestUpdate === 'function') {
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
                <button className="button" onClick={() => handleConnectRequest('accept')}>Accept connect</button>
                <button className="button" onClick={() => handleConnectRequest('reject')}>Reject connect</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        );
    }
    return (
        <div>
            <button className="button" onClick={handleSendRequest}>
                {hasConnection ? 'Disconnect' : request ? 'Cancel request' : 'Connect'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    );
}

export default ManageConnectionButton;

