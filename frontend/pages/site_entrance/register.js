import axios from 'axios';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import '../css/logins.css'; 

function Register() {
    const [error, setError] = useState('');
    const history = useHistory();
    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        try {
            const response = await axios.post('/register', { username, password });

            if (response.status === 200 || response.status === 201) {
                history.push('/login');
            } else {
                setError('Registration failed, please try again.');
                history.push('/register');
            }
        } catch (error) {
            setError(error.response ? error.response.data.message : 'Network error');
        }
    };

    return (
        <div className="container">
            <div className="login-register">
                <h1>Register</h1>
                <a className="link" href="/login">Login</a>
            </div>
            {error && <p className="error-message">{error}</p>}
            <form method="post" onSubmit={handleSubmit}>
                <input className="input-box" type="text" name="username" placeholder="Username" required />
                <input className="input-box" type="password" name="password" placeholder="Password" required />
                <input className="submit" type="submit" value="Register" />
            </form>
        </div>
    );
}

export default Register;
