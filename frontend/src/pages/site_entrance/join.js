import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../css/authentication.css'; 

const Join = () => {
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        try {
            const response = await axios.post('/api/join', { username: event.target.username.value, password });
            if (response.data.success) {
                navigate('/login');
            } else {
                setError('Joining failed, please try again');
            }
        } catch (error) {
            setError(error.response ? error.response.data.message : 'Network error');
        }
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
                    <a className="link" href="/login">Login</a>
                </div>
                <p className="error-message">{error}</p>
                <form method="post" onSubmit={handleSubmit}>
                    <input className="authentication-input-box" name="username" placeholder="Username" required />
                    <input 
                        type="password" 
                        className="authentication-input-box" 
                        name="password" placeholder="Password" 
                        required onChange={(e) => setPassword(e.target.value)}
                        />
                    <input 
                        type="password" 
                        className="authentication-input-box" 
                        name="password" placeholder="Re-enter password" 
                        required onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    <input className="submit" type="submit" value="Join" />
                </form>
            </div>
        </div>
    );
}

export default Join;
