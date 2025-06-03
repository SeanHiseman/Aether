import axios from 'axios';
import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import '../../css/authentication.css'; 

const Join = () => {
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleJoin = async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const username = event.target.username.value;
        if (!validateEmail(email)) {
            setErrorMessage('Please enter a valid email address');
            setTimeout(() => { setErrorMessage(''); }, 3000);
            return;
        }
        if (username.length > 30) {
            setErrorMessage('Username cannot exceed 30 characters');
            setTimeout(() => { setErrorMessage(''); }, 3000);
            return;
        }
        if (email.length > 500) {
            setErrorMessage('Email cannot exceed 500 characters');
            setTimeout(() => { setErrorMessage(''); }, 3000);
            return;
        }
        if (password.length > 120) {
            setErrorMessage('Password cannot exceed 120 characters');
            setTimeout(() => { setErrorMessage(''); }, 3000);
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            setTimeout(() => { setErrorMessage(''); }, 3000);
            return;
        }
        try {
            const response = await axios.post('/api/join', { email, password, username });
            if (response.data.success) {
                navigate('/g/Welcome');
            } else {
                setErrorMessage('Joining failed, please try again');
                setTimeout(() => { setErrorMessage(''); }, 3000);
            }
        } catch (error) {
            if (error.response?.status === 409) {
                const message = error.response.data.message;
                if (message === 'Email already registered') {
                    setErrorMessage('Email already registered. Please use a different email or login.');
                } else if (message === 'Username already taken') {
                    setErrorMessage('Username already taken. Please choose a different username.');
                } else {
                    setErrorMessage('Account already exists');
                }
            } else if (error.response?.status === 400) {
                setErrorMessage(error.response.data.message || 'Invalid input');
            } else {
                setErrorMessage('Joining failed, please try again');
            }
            setTimeout(() => { setErrorMessage(''); }, 3000);
        }
    };    

    const togglePasswordVisibility = (setter, currentState) => {
        setter(!currentState);
    };

    document.title = "Join";
    return (
        <div className="authentication-container">
            <Link to="/welcome">
                <p className="welcome-text pointer">Welcome to Aether</p>
            </Link>
            <div className="authentication-box">
                <div className="login-register">
                    <h1>Join</h1>
                    <Link to="/login">
                        <p className="link">Login</p>
                    </Link>
                </div>
                <p className="error-message">{errorMessage}</p>
                <form method="post" onSubmit={handleJoin}>
                    <input
                        className="authentication-input-box"
                        name="username"
                        placeholder="Username"
                        required
                        value={username}
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= 30) {
                                setUsername(input);
                                setErrorMessage(""); 
                            } else {
                                setErrorMessage("Username cannot exceed 30 characters");
                            }
                        }}
                    />
                    <input
                        type="email"
                        className="authentication-input-box"
                        name="email"
                        placeholder="Email"
                        required
                        value={email}
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= 500) {
                                setEmail(input);
                                setErrorMessage(""); 
                            } else {
                                setErrorMessage("Email cannot exceed 500 characters");
                            }
                        }}
                    />
                    <div className="password-container">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            className="authentication-input-box" 
                            name="password" 
                            placeholder="Password" 
                            required 
                            value={password}
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 120) {
                                    setPassword(input);
                                    setErrorMessage("");
                                } else {
                                    setErrorMessage("Password cannot exceed 120 characters");
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
                            name="confirm-password" 
                            placeholder="Re-enter password" 
                            required 
                            value={confirmPassword}
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 30) {
                                    setConfirmPassword(input);
                                    setErrorMessage("");
                                } else {
                                    setErrorMessage("Password cannot exceed 30 characters");
                                }
                            }} 
                        />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowConfirmPassword, showConfirmPassword)} title={showConfirmPassword ? "Hide password" : "Show password"}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input className="submit" type="submit" value="Join" />
                </form>
            </div>
        </div>
    );
}

export default Join;