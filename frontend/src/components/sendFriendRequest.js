import axios from "axios";
import React, { useEffect, useState } from "react"

function SendFriendRequestButton({ userId, receiverUserId, isRequestSent }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [request, setRequest] = useState(isRequestSent);

    useEffect(() => {
        setRequest(isRequestSent);
    }, [isRequestSent]);

    const handleSendRequest = () => {
        const url = request ? 'cancel_friend_request' : 'send_friend_request';
        axios.post(`/api/${url}`, {userId, receiverUserId})
            .then(() => {
                setRequest(!isRequestSent);
            }).catch(error => {
                setErrorMessage("Friend request error.", error);
            });
    };

    return (
        <div>
            <button className="button" onClick={handleSendRequest}>
                {request ? 'Cancel request' : 'Add friend'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>

    );
}

export default SendFriendRequestButton

