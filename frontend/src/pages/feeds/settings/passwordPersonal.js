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
    const maxEmailLength = 500;
    const maxPasswordLength = 50;

    const changeEmail = async (event) => {
        event.preventDefault();
        if (email.length > maxEmailLength) {
            setEmailMessage(`Email cannot exceed ${maxEmailLength} characters`);
            setTimeout(() => { setEmailMessage(''); }, 5000);
            return;
        }
        if (email !== confirmEmail) {
            setEmailMessage('Emails do not match');
            setTimeout(() => { setEmailMessage(''); }, 5000);
            return;
        }
        try {
            const response = await axios.post('/api/change_email', { email, userId: user.user_id });
            setEmail('');
            setConfirmEmail('');
            setEmailMessage(response.data.success ? 'Email changed' : 'Email change error, please try again');
            setTimeout(() => { setEmailMessage(''); }, 5000);
        } catch (error) {
            setEmailMessage('Email change error, please try again');
            setTimeout(() => { setEmailMessage(''); }, 5000);
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        if (password.length > maxPasswordLength) {
            setPasswordMessage(`Password cannot exceed ${maxPasswordLength} characters`);
            setTimeout(() => { setPasswordMessage(''); }, 5000);
            return;
        }
        if (password !== confirmPassword) {
            setPasswordMessage('Passwords do not match');
            setTimeout(() => { setPasswordMessage(''); }, 5000);
            return;
        }
        try {
            const response = await axios.post('/api/change_password', { password, user_id: user.user_id });
            setPassword('');
            setConfirmPassword('');
            setPasswordMessage(response.data.success ? 'Password changed' : 'Password change error, please try again');
            setTimeout(() => { setPasswordMessage(''); }, 5000);
        } catch (error) {
            setPasswordMessage('Password change error, please try again');
            setTimeout(() => { setPasswordMessage(''); }, 5000);
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
                        <input 
                            type={showPassword ? "text" : "password"} 
                            className="authentication-input-box" 
                            name="password" 
                            placeholder="New password" 
                            required 
                            value={password} 
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 30) {
                                    setPassword(input);
                                    setPasswordMessage("");
                                } else {
                                    setPasswordMessage("Password cannot exceed 30 characters");
                                }
                            }} 
                        />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowPassword, showPassword)} title={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <div className="password-container">
                        <input 
                            type={showConfirmPassword ? "text" : "password"} 
                            className="authentication-input-box" 
                            name="password" 
                            placeholder="Re-enter password" 
                            required 
                            value={confirmPassword} 
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 30) {
                                    setConfirmPassword(input);
                                    setPasswordMessage("");
                                } else {
                                    setPasswordMessage("Password cannot exceed 30 characters");
                                }
                            }} 
                        />
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
                    <input 
                        type="email" 
                        className="authentication-input-box" 
                        name="email" 
                        placeholder="New email" 
                        required 
                        value={email} 
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= 500) {
                                setEmail(input);
                                setEmailMessage(""); 
                            } else {
                                setEmailMessage("Email cannot exceed 500 characters");
                            }
                        }} 
                    />
                    <input 
                        type="email" 
                        className="authentication-input-box" 
                        name="email" 
                        placeholder="Re-enter email" 
                        required 
                        value={confirmEmail} 
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= 500) {
                                setConfirmEmail(input);
                                setEmailMessage(""); 
                            } else {
                                setEmailMessage("Email cannot exceed 500 characters");
                            }
                        }} 
                    />
                    <input className="submit" type="submit" value="Change email" />
                </form>
                <p className="error-message">{emailMessage}</p>
            </div>
        </div>
    );
};

export default PasswordPersonal;