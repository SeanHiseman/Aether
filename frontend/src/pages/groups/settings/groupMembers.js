import axios from 'axios';
import React, { useEffect, useState } from 'react';

const GroupMembers = ({ group }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [members, setMembers] = useState([]);

    const getGroupMembers = async () => {
        //try {
            const response = await axios.get('/api/get_group_members', {
                params: { group_id: group.groupId }
            });
            setMembers(response.data);
            console.log("members:", response.data);
        //} catch (error) {
            //console.error('Error fetching group members:', error);
        //}
    };

    useEffect(() => {
        getGroupMembers();
    }, []);

    //Admins can remove members
    const removeMember = async (userId) => {
        try {
            const groupId = group.groupId;
            await axios.post('/api/leave_group', { userId, groupId })
            getGroupMembers();
        } catch (error) {
            setErrorMessage('Error removing member:', error);
        }
    };

    //Allows adding/remvoing of moderators
    const toggleModeratorStatus = async (userId, isMod) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                groupId: group.groupId,
                userId: userId,
                isMod: !isMod, //Opposite to current state
            });
            if (response.status === 200) {
                getGroupMembers();
            }
        } catch (error) {
            console.error("Error toggling moderator status:", error);
        }
    };

    return (
        <div id="profile-settings">
            <div>
                {members.map((member, index) => (
                    <div className="group-member" key={index}>
                        {member.user.username}
                        <button className="button" onClick={() => toggleModeratorStatus(member.user.user_id, member.is_mod)}>
                            {member.is_mod ? 'Remove moderator' : 'Make moderator'}
                        </button>
                        <button className="button" onClick={() => removeMember(member.user.user_id)}>Remove member</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupMembers;