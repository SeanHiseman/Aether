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
            setErrorMessage('Error deleting feed', error);
        }
    };

    return (
        <div className="profile-settings">
            <div className="display-area">
                <p className="text36">Are you sure you wish to delete this feed?</p>
                <p className="text24">This action cannot be reversed</p>
                <p className="text24">All posts, channels, followers and feed information will be lost</p>
                <button className="button delete" onClick={deleteGroup}>Delete feed</button>
                <div className="error-message">{errorMessage}</div>
            </div>
        </div>
    );
};

export default GroupDeletion;