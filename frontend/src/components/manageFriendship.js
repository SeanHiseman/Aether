import axios from "axios";
import React, { useEffect, useState } from "react"

function ManageFriendshipButton({ userId, receiverProfileId, receiverUserId, isRequestSent, isFriend }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [friend, setFriend] = useState(isFriend);
    const [request, setRequest] = useState(isRequestSent);

    //Toggles friendship status
    useEffect(() => {
        setRequest(isRequestSent);
        setFriend(isFriend);
    }, [isRequestSent, isFriend]);

    const handleSendRequest = async () => {
        try {
            const method = friend ? 'delete' : 'post';
            const requestData = { userId, receiverUserId, receiverProfileId };
            const url = request ? 'cancel_friend_request' : 'send_friend_request';

            const response = await axios[method](`/api/${url}`, requestData);

            if (response.status === 200) {
                if (method === 'delete') {
                    //Removing a friend or canceling a request
                    setFriend(false);
                    setRequest(false);
                } else {
                    //Sending a friend request
                    setRequest(true);
                    setFriend(false);
                }
            } else {
                console.error('Error:', response.data);
            }
        } catch (error) {
            setErrorMessage("Friend request error.", error);
        }
    };

    return (
        <div>
            <button className="button" onClick={handleSendRequest}>
                {friend ? 'Remove friend' : request ? 'Cancel request' : 'Add friend'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>

    );
}

export default ManageFriendshipButton;

