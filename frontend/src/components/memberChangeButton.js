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

    const handleMemberChange = async () => {
        try {
            if (isPrivate && !member && !request) {
                await axios.post('/api/send_follow_request', { receiverId: groupId, senderId: userId });
                setRequest(true);
            } else if (isPrivate && request) {
                await axios.delete('/api/cancel_follow_request', { data: { userId, groupId } });
                setRequest(false);
            } else {
                //Public groups can be freely left/joined
                const url = member ? 'unfollow_group' : 'follow_group';
                await axios.post(`/api/${url}`, { userId, groupId });
                setMember(!member);
            }
        } catch (error) {
            setErrorMessage("Error updating following");
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