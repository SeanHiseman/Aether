import axios from 'axios';
import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import '../../css/authentication.css'; 

const Join = () => {
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();

    const handleJoin = async (event) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            return;
        }
        try {
            const response = await axios.post('/api/join', { 
                email: event.target.email.value, 
                password, 
                username: event.target.username.value 
            });
            if (response.data.success) {
                navigate('/g/Welcome');
            } else {
                setErrorMessage('Joining failed, please try again');
            }
        } catch (error) {
            if (error.response && error.response.status === 409) {
                setErrorMessage('Name already taken');
            } else {
                setErrorMessage('Joining failed, please try again');
            }
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
                    <input className="authentication-input-box" name="username" placeholder="Username" required />
                    <input type="email" className="authentication-input-box" name="email" placeholder="Email" required />
                    <div className="password-container">
                        <input type={showPassword ? "text" : "password"} className="authentication-input-box" name="password" placeholder="Password" required onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowPassword, showPassword)} title={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <div className="password-container">
                        <input type={showConfirmPassword ? "text" : "password"} className="authentication-input-box" name="confirm-password" placeholder="Re-enter password" required onChange={(e) => setConfirmPassword(e.target.value)} />
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
