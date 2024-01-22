import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/logins.css'; 

function Login() {
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        try {
            const response = await axios.post('/login', { username, password });

            //successful login
            if (response.data.success) {
                navigate.push('/home');
            } else {
                //If login unsuccessful
                setError(response.data.message);
            }
        } catch (error) {
            setError(error.response ? error.response.data.message : 'Network error');
        }
    };

    return (
        <div className="container">
            <div className="login-register">
                <h1>Login</h1>
                <a className="link" href="/register">Register</a>
            </div>
            {error && <p className="error-message">{error}</p>}
            <form method="post" onSubmit={handleSubmit}>
                <input className="input-box" type="text" name="username" placeholder="Username" required />
                <input className="input-box" type="password" name="password" placeholder="Password" required />
                <input className="submit" type="submit" value="Login" />
            </form>
        </div>
    );
}

export default Login;
