import axios from 'axios';
import React, { useCallback, useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../../components/authContext';

const GroupMembers = ({ group }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [members, setMembers] = useState([]);
    const { user } = useContext(AuthContext);

    const getGroupMembers = useCallback(async () => {
        try {
            const response = await axios.get('/api/get_group_members', {
                params: { group_id: group.groupId }
            });
            setMembers(response.data);
        } catch (error) {
            setErrorMessage('Error getting followers');
        }
    }, [group.groupId]);
    
    useEffect(() => {
        getGroupMembers();
    }, []);

    //Admins can remove members
    const removeMember = async (member) => {
        try {
            const groupId = group.groupId;
            await axios.post('/api/unfollow_group', { userId: member.user.user_id, groupId })
            getGroupMembers();
        } catch (error) {
            setErrorMessage('Error removing member');
        }
    };

    //Allows adding/remvoing of moderators
    const toggleModeratorStatus = async (member) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                groupId: group.groupId,
                userId: member.user.user_id,
                isMod: !member.is_mod, //Opposite to current state
            });
            if (response.status === 200) {
                getGroupMembers();
            }
        } catch (error) {
            setErrorMessage("Error toggling moderator status");
        }
    };

    return (
        <div className="channel-content">
            <h2>Followers</h2>
            <ul className="content-list">
                <div className="error-message">{errorMessage}</div>
                {members.map((member, index) => (
                    <li key={index}>
                        <div className="result-widget">
                            <Link className="profile-link" to={`/profile/${member.user.username}`}>
                                <img className="large-profile-photo" src={`/${member.user.profile.profile_photo}`} alt="Profile" />
                                <p className="large-text profile-name">{member.user.username}</p>
                            </Link>
                            <button className="button" onClick={() => toggleModeratorStatus(member)}>
                                {member.is_mod ? 'Remove as moderator' : 'Make moderator'}
                            </button>
                            {member.user.user_id !== user.userId &&
                                <button className="button" onClick={() => removeMember(member)}>Remove follower
                            </button>}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GroupMembers;