import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AccountDeletion = ({ profile }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const deleteAccount = async () => {
        try {
            const response = await axios.delete('/api/delete_account', { data: { user_id: profile.userId } });
                if (response.data.success) {
                    navigate('/login');
                }
        } catch (error) {
            setErrorMessage('Error deleting account:' +  error);
        }
    };

    return (
        <div id="profile-settings">
            <div id="display-area">
                <p style={{fontSize: 36}}>Are you sure you wish to delete your account?</p>
                <p style={{fontSize: 24}}>This action cannot be reversed</p>
                <p style={{fontSize: 24}}>All posts, messages, friends and account information will be lost</p>
                <button className="button delete" onClick={deleteAccount}>Delete account</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </div>
        </div>
    );
};

export default AccountDeletion;