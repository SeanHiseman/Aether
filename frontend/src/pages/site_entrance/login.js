import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/authentication.css'; 

const Login = () => {
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        try {
            const response = await axios.post('/api/login', { username, password });
            //successful login
            if (response.data.success) {
                navigate(`/u/${username}`);
            } else {
                //If login unsuccessful
                setError(response.data.message);
            }
        } catch (error) {
            setError('Login error, please try again');
        }
    };

    document.title = "Login";
    return (
        <div className="authentication-container">
            <p className="welcome-text">Welcome back</p>
            <div className="authentication-box">
                <div className="login-register">
                    <h1>Login</h1>
                    <a className="link" href="/join">Join</a>
                </div>
                {error && <p className="error-message">{error}</p>}
                <form method="post" onSubmit={handleSubmit}>
                    <input className="authentication-input-box" name="username" placeholder="Username" required />
                    <input type="password" className="authentication-input-box" name="password" placeholder="Password" required />
                    <input className="submit" type="submit" value="Login" />
                </form>
            </div>
        </div>
    );
}

export default Login;
