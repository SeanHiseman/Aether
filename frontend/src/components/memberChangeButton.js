import axios from "axios";
import React, { useEffect, useState } from "react"

const MemberChangeButton = ({ userId, groupId, isMember }) => {
    const [member, setMember] = useState(isMember);

    //Update member state
    useEffect(() => {
        setMember(isMember);
    }, [isMember]);

    const handleMemberChange = () => {
        //Depends on if user is already a group member
        const url = member ? 'leave_group' : 'join_group';
        axios.post(`/api/${url}`, {userId, groupId })
            .then(() => {
                setMember(!member);
                //Reload page upon joining/leaving
                window.location.reload();
            })
            .catch(error => {
                console.error("Error updating group membership", error);
            });
    };

    return (
        <button className="light-button" onClick={handleMemberChange}>
            {member ? 'Leave' : 'Join'}
        </button>
    )
}

export default MemberChangeButton;