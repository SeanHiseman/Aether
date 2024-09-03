import axios from "axios";
import React, { useEffect, useState } from "react"

const MemberChangeButton = ({ userId, groupId, isMember, isRequestSent, isPrivate }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [member, setMember] = useState(isMember);
    const [request, setRequest] = useState(isRequestSent);

    //Update member state, including requests for private feeds
    useEffect(() => {
        setRequest(isRequestSent);
        setMember(isMember);
    }, [isRequestSent, isMember]);

    const handleMemberChange = () => {
        if (isPrivate && !member && !request) {
            //Send join request for private group
            axios.post('/api/send_join_request', { receiverId: groupId, senderId: userId })
                .then(() => {
                    setRequest(true);
                })
                .catch(error => {
                    setErrorMessage("Error sending follow request", error);
                });
        } else if (isPrivate && request) {
            //Cancel join request for private group
            axios.delete('/api/cancel_join_request', { data: { userId, groupId } })
                .then(() => {
                    setRequest(false);
                })
                .catch(error => {
                    setErrorMessage("Error cancelling follow request", error);
                });
        } else {
            //Join or leave public group
            const url = member ? 'leave_group' : 'join_group';
            axios.post(`/api/${url}`, { userId, groupId })
                .then(() => {
                    setMember(!member);
                })
                .catch(error => {
                    setErrorMessage("Error", error);
                });
        }
    };

    const buttonText = member ? 'Unfollow' : request && isPrivate ? 'Cancel request' : 'Follow';

    return (
        <div>
            <button className="button" onClick={handleMemberChange}>
                {buttonText}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default MemberChangeButton;