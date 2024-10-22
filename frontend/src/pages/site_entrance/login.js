import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../css/authentication.css'; 

const Login = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');
        try {
            const response = await axios.post('/api/login', { username, password });
            if (response.status === 200) {
                navigate(`/u/${username}`);//Main feed name same as username (for now)
            } 
        } catch (error) {
            if (error.response && error.response.status === 401) {
                setErrorMessage('Invalid username or password');
            } else {
                setErrorMessage('Login error, please try again');
            }
        }
    };

    document.title = "Login";
    return (
        <div className="authentication-container">
            <p className="welcome-text">Welcome back</p>
            <div className="authentication-box">
                <div className="login-register">
                    <h1>Login</h1>
                    <Link to="/join">
                        <p className="link">Join</p>
                    </Link>
                </div>
                <p className="error-message">{errorMessage}</p>
                <form method="post" onSubmit={handleLogin}>
                    <input className="authentication-input-box" name="username" placeholder="Username" required />
                    <input type="password" className="authentication-input-box" name="password" placeholder="Password" required />
                    <input className="submit" type="submit" value="Login" />
                </form>
            </div>
        </div>
    );
}

export default Login;
