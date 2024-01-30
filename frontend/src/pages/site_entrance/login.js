import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/logins.css'; 

function Login() {
    document.title = "Login";
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
                navigate('/home');
            } else {
                //If login unsuccessful
                setError(response.data.message);
            }
        } catch (error) {
            setError(error.response ? error.response.data.message : 'Network error');
        }
    };

    return (
        <div className="authentication-container">
            <div className="login-register">
                <h1>Login</h1>
                <a className="link" href="/register">Register</a>
            </div>
            {error && <p className="error-message">{error}</p>}
            <form method="post" onSubmit={handleSubmit}>
                <input className="authentication-input-box" name="username" placeholder="Username" required />
                <input type="password" className="authentication-input-box" name="password" placeholder="Password" required />
                <input className="submit" type="submit" value="Login" />
            </form>
        </div>
    );
}

export default Login;
