import axios from "axios";
import React, { useEffect, useState } from "react"

const ManageConnectionButton = ({ viewerId, receiverId, isRequestSent, isConnected }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [connection, setConnection] = useState(isConnected);
    const [request, setRequest] = useState(isRequestSent);

    //Toggles friendship status
    useEffect(() => {
        setRequest(isRequestSent);
        setConnection(isConnected);
    }, [isRequestSent, isConnected]);

    const handleSendRequest = async () => {
        try {
            let method, requestData, url;
            if (connection) {
                method = 'delete';
                url = '/api/delete_connection';
                requestData = { receiverId, viewerId };
            } else if (request) {
                method = 'delete';
                requestData = { receiverId, viewerId };
                url = '/api/delete_connect_request';
            } else {
                method = 'post';
                requestData = { receiverId, viewerId };
                url = '/api/send_connect_request';
            }
            const response = await axios({
                method,
                url,
                data: requestData,
            });
            if (response.status === 200) {
                if (method === 'delete') {
                    if (url === 'remove_connection') {
                    //Removing a friend
                    setConnection(false);
                    setRequest(false);
                    } else {
                        //Canceling a request
                        setConnection(false);
                        setRequest(false);
                    }
                } else {
                    //Sending a friend request
                    setRequest(true);
                    setConnection(false);
                }
            } else {
                setErrorMessage("Friend request error");
            }
        } catch (error) {
            setErrorMessage("Friend request error");
        }
    };
    
    //If viewing themselves
    if (viewerId === receiverId) {
        return;
    } else {
    return (
        <div>
            <button className="button" onClick={handleSendRequest}>
                {connection ? 'Disconnect' : request ? 'Cancel request' : 'Connect'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>

    )};
}

export default ManageConnectionButton;

