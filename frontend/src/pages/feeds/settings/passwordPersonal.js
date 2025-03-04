import axios from 'axios';
import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const PasswordPersonal = ({ user }) => {
    const [confirmEmail, setConfirmEmail] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [password, setPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const changeEmail = async (event) => {
        event.preventDefault();
        if (email !== confirmEmail) {
            setEmailMessage('Emails do not match');
            return;
        }
        try {
            const response = await axios.post('/api/change_email', { email, userId: user.user_id });
            if (response.data.success) {
                setEmail('');
                setConfirmEmail('');
                setEmailMessage('Email changed');
            } else {
                setEmailMessage('Email change error, please try again');
            }
        } catch (error) {
          setEmailMessage('Email change error, please try again');
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setPasswordMessage('Passwords do not match');
            return;
        }
        try {
            const response = await axios.post('/api/change_password', { password, user_id: user.user_id });
            if (response.data.success) {
                setPassword('');
                setConfirmPassword('');
                setPasswordMessage('Password changed');
            } else {
                    setPasswordMessage('Password change error, please try again');
            }
        } catch (error) {
            setPasswordMessage('Password change error, please try again');
        }
    };

    const togglePasswordVisibility = (setter, currentState) => {
        setter(!currentState);
    };

    return (
        <div className="feed-settings">
            <div className="display-area">
                <p className="text36">Change password</p>
                <form method="post" onSubmit={changePassword} style={{ width: "60%" }}>
                    <div className="password-container">
                        <input type={showPassword ? "text" : "password"} className="authentication-input-box" name="password" placeholder="New password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowPassword, showPassword)} title={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <div className="password-container">
                        <input type={showConfirmPassword ? "text" : "password"} className="authentication-input-box" name="password" placeholder="Re-enter password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowConfirmPassword, showConfirmPassword)} title={showConfirmPassword ? "Hide password" : "Show password"}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input className="submit" type="submit" value="Change password" />
                </form>
                <p className="error-message">{passwordMessage}</p>
            </div>
            <div className="display-area">
                <p className="text36">Change email</p>
                <form method="post" onSubmit={changeEmail} style={{ width: "60%" }}>
                    <input type="email" className="authentication-input-box" name="email" placeholder="New email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="email" className="authentication-input-box" name="email" placeholder="Re-enter email" required value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
                    <input className="submit" type="submit" value="Change email" />
                </form>
                <p className="error-message">{emailMessage}</p>
            </div>
        </div>
    );
};

export default PasswordPersonal;