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
        <div>
            <button className="button" onClick={deleteAccount}>Delete account</button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    );
};

export default AccountDeletion;