import axios from "axios";
import React, { useEffect, useState } from "react"

const MemberChangeButton = ({ userId, groupId, isMember }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [member, setMember] = useState(isMember);

    //Update member state
    useEffect(() => {
        setMember(isMember);
    }, [isMember]);

    const handleMemberChange = () => {
        //Depends on if user is already a group member
        const url = member ? 'leave_group' : 'join_group';
        axios.post(`/api/${url}`, { userId, groupId })
            .then(() => {
                setMember(!member);
                //Reload page upon joining/leaving
                //window.location.reload();
            }).catch(error => {
                setErrorMessage("Error updating group membership", error);
            });
    };

    return (
        <div>
            <button className="button" onClick={handleMemberChange}>
                {member ? 'Leave' : 'Join'}
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    )
}

export default MemberChangeButton;