import axios from "axios";
import React, { useEffect, useState } from "react"

function ManageFriendshipButton({ userId, receiverUserId, isRequestSent, isFriend }) {
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
            let method, requestData, url;
            if (friend) {
                method = 'delete';
                url = '/api/remove_friend';
                requestData = { receiverUserId, userId };
            } else if (request) {
                method = 'delete';
                requestData = { receiverUserId, userId };
                url = '/api/cancel_friend_request';
            } else {
                method = 'post';
                requestData = { receiverUserId, userId };
                url = '/api/send_friend_request';
            }
            const response = await axios({
                method,
                url,
                data: requestData,
            });

            if (response.status === 200) {
                if (method === 'delete') {
                    if (url === 'remove_friend') {
                    //Removing a friend
                    setFriend(false);
                    setRequest(false);
                    } else {
                        //Canceling a request
                        setFriend(false);
                        setRequest(false);
                    }
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
    //If user is viewing themselves
    if (userId == receiverUserId) {
        return (<></>);
    } else {
    return (
        <div>
            <button className="button" onClick={handleSendRequest}>
                {friend ? 'Remove friend' : request ? 'Cancel request' : 'Add friend'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>

    )};
}

export default ManageFriendshipButton;

