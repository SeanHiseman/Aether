import axios from 'axios';
import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const Account = () => {
    const [confirmEmail, setConfirmEmail] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [password, setPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { user } = useOutletContext();
    const maxEmailLength = 500;
    const maxPasswordLength = 120;

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const changeEmail = async (event) => {
        event.preventDefault();
        if (!validateEmail(email) || email !== confirmEmail || email === user.email || emailMessage) { //Redundant check
            return;
        }
        try {
            const response = await axios.post('/api/change_email', { email, userId: user.user_id });
            if (response.data.success) {
                setEmail('');
                setConfirmEmail('');
                setEmailMessage('Verification email sent! Please check your new email address.');
            }
        } catch (error) {
            if (error.response?.status === 409) {
                setEmailMessage('This email is already in use');
            } else if (error.response?.status === 400) {
                setEmailMessage(error.response.data.error || 'Invalid email');
            } else {
                setEmailMessage('Email change error, please try again');
            }
            setTimeout(() => { setEmailMessage(''); }, 5000);
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        if (password !== confirmPassword || passwordMessage) { //Redundant check
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
                <p className="error-message">{passwordMessage}</p>
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
                                if (input.length <= maxPasswordLength) {
                                    setPassword(input);
                                    if (confirmPassword && input !== confirmPassword) {
                                        setPasswordMessage("Passwords do not match");
                                    } else if (confirmPassword && input === confirmPassword) {
                                        setPasswordMessage("");
                                    }
                                } else {
                                    setPasswordMessage(`Password cannot exceed ${maxPasswordLength} characters`);
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
                                if (input.length <= maxPasswordLength) {
                                    setConfirmPassword(input);
                                    if (password && input !== password) {
                                        setPasswordMessage("Passwords do not match");
                                    } else if (password && input === password) {
                                        setPasswordMessage("");
                                    }
                                } else {
                                    setPasswordMessage(`Password cannot exceed ${maxPasswordLength} characters`);
                                }
                            }} 
                        />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowConfirmPassword, showConfirmPassword)} title={showConfirmPassword ? "Hide password" : "Show password"}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input 
                        className="submit" 
                        type="submit" 
                        value="Change password" 
                        disabled={!password || !confirmPassword || !!passwordMessage}
                    />
                </form>
            </div>
            <div className="display-area">
                <p className="text36">Change email</p>
                <p className="text16 faded-text">Current email: {user.email}</p>
                <p className="error-message">{emailMessage}</p>
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
                            if (input.length <= maxEmailLength) {
                                setEmail(input);
                                if (input && validateEmail(input) && input !== user.email) {
                                    setEmailMessage("");
                                }
                                if (confirmEmail && input !== confirmEmail) {
                                    setEmailMessage("Emails do not match");
                                }
                            } else {
                                setEmailMessage(`Email cannot exceed ${maxEmailLength} characters`);
                            }
                        }}
                        onBlur={(e) => {
                            if (e.target.value) {
                                if (!validateEmail(e.target.value)) {
                                    setEmailMessage("Please enter a valid email address");
                                } else if (e.target.value === user.email) {
                                    setEmailMessage("Must use a different email to the current");
                                }
                            }
                        }}
                    />
                    <input 
                        type="email" 
                        className="authentication-input-box" 
                        name="confirm-email" 
                        placeholder="Re-enter email" 
                        required 
                        value={confirmEmail} 
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= maxEmailLength) {
                                setConfirmEmail(input);
                                if (email && input !== email) {
                                    setEmailMessage("Emails do not match");
                                } else if (email && input === email && validateEmail(email) && email !== user.email) {
                                    setEmailMessage("");
                                }
                            } else {
                                setEmailMessage(`Email cannot exceed ${maxEmailLength} characters`);
                            }
                        }} 
                    />
                    <input 
                        className="submit" 
                        type="submit" 
                        value="Change email" 
                        disabled={!email || !confirmEmail || !!emailMessage}
                    />
                </form>
            </div>
        </div>
    );
};

export default Account;