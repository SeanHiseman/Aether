import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GroupDeletion = ({ group }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const deleteGroup = async () => {
        try {
            const response = await axios.delete('/api/delete_group', { data: { group_id: group.groupId } });
                if (response.data.success) {
                    navigate('/recommended');
                }
        } catch (error) {
            setErrorMessage('Error deleting account:' +  error);
        }
    };

    return (
        <div id="profile-settings">
            <div id="deletion-area">
                <p style={{fontSize: 36}}>Are you sure you wish to delete this group?</p>
                <p style={{fontSize: 24}}>This action cannot be reversed</p>
                <p style={{fontSize: 24}}>All posts, channels, members and group information will be lost</p>
                <button className="button delete" onClick={deleteGroup}>Delete group</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
};

export default GroupDeletion;