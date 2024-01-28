import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/logins.css'; 

function Register() {
    document.title = "Register";
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        try {
            const response = await axios.post('/register', { username, password });

            if (response.status === 200 || response.status === 201) {
                navigate.push('/login');
            } else {
                setError('Registration failed, please try again.');
                navigate.push('/register');
            }
        } catch (error) {
            setError(error.response ? error.response.data.message : 'Network error');
        }
    };

    return (
        <div className="authentication-container">
            <div className="login-register">
                <h1>Register</h1>
                <a className="link" href="/login">Login</a>
            </div>
            {error && <p className="error-message">{error}</p>}
            <form method="post" onSubmit={handleSubmit}>
                <input className="authentication-input-box" name="username" placeholder="Username" required />
                <input className="authentication-input-box" name="password" placeholder="Password" required />
                <input className="submit" type="submit" value="Register" />
            </form>
        </div>
    );
}

export default Register;
