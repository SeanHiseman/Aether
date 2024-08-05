import axios from 'axios';
import React, { useState } from 'react';

const PasswordPersonal = ({ user }) => {
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [password, setPassword] = useState('');

    const changePassword = async (event) => {
        event.preventDefault();
        
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            return;
        }
        
        try {
            const response = await axios.post('/api/change_password', { password, user_id: user.userId });
            if (response.data.success) {
                setPassword('');
                setConfirmPassword('');
                setErrorMessage('Password changed');
            } else {
                setErrorMessage('Password change error, please try again');
            }
        } catch (error) {
            setErrorMessage('Password change error, please try again');
        }
    };

    return (
        <div id="profile-settings">
            <div id="display-area">
                <p class="text36">Change password</p>
                <form method="post" onSubmit={changePassword}>
                    <input 
                        type="password" 
                        className="authentication-input-box" 
                        name="password" placeholder="New password" 
                        required 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        />
                    <input 
                        type="password" 
                        className="authentication-input-box" 
                        name="password" placeholder="Re-enter password" 
                        required 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    <input className="submit" type="submit" value="Change password" />
                </form>
                <p className="error-message">{errorMessage}</p>
            </div>
        </div>
    );
};

export default PasswordPersonal;