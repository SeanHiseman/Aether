import axios from "axios";
import React, { useEffect, useState } from "react"

const ManageConnectionButton = ({ connectRequest, feed, isConnected, viewerId, onRequestUpdate }) => {
    //console.log(connectRequest, feed, isConnected, viewerId);
    const [errorMessage, setErrorMessage] = useState('');
    const [connection, setConnection] = useState(isConnected || feed?.isConnected);
    const [request, setRequest] = useState(connectRequest || feed?.hasConnectRequest);
    const receiverId = feed?.feed_id || feed?.receiver_id;

    useEffect(() => {
        setRequest(connectRequest || feed?.hasConnectRequest);
        setConnection(isConnected || feed?.isConnected);
    }, [connectRequest, feed?.hasConnectRequest, isConnected, feed?.isConnected]);

    const handleSendRequest = async () => {
        try {
            let method, requestData, url;
            if (connection) {
                method = 'delete';
                url = '/api/delete_connection';
                requestData = { deleterId: viewerId, feedId: receiverId };
            } else if (request) {
                method = 'delete';
                url = '/api/delete_connect_request';
                requestData = { receiverId, senderId: viewerId };
            } else {
                method = 'post';
                requestData = { receiverId, senderId: viewerId };
                url = '/api/send_connect_request';
            }
            const response = await axios({
                method,
                url,
                data: requestData,
            });
            if (response.status === 200) {
                if (method === 'delete') {
                    setConnection(false);
                    setRequest(false);
                } else {
                    setRequest(true);
                    setConnection(false);
                }
            } else {
                setErrorMessage("Connect request error");
            }
        } catch (error) {
            setErrorMessage("Connect request error");
        }
    };

    const handleConnectRequest = async (result) => {
        try {
            let response;
            if (result === 'accept') {
                response = await axios.post('/api/accept_connect_request', { receiverId: viewerId, senderId: feed.feed_id });
            } else if (result === 'reject') {
                response = await axios.delete('/api/delete_connect_request', { data: { receiverId: viewerId, senderId: feed.feed_id } });
            }
            if (response.status === 200) {
                if (connectRequest) {
                    onRequestUpdate(request.sender_id);
                } else {
                    setRequest(false);
                    setConnection(result === 'accept');
                }
            }
        } catch (error) {
            setErrorMessage("Error handling request");
        }
    };    

    if (viewerId === receiverId && request && !connection) {
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
                {connection ? 'Disconnect' : request ? 'Cancel request' : 'Connect'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    );
}

export default ManageConnectionButton;

