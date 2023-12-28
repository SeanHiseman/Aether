import axios from 'axios';
import React from 'react';
import { useHistory } from 'react-router-dom';
import '../css/logins.css'; 

function Login() {
    const history = useHistory();
   
    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        try {
            const response = await axios.post('/login', {
                username,
                password
            });

            //successful login
            if (response.status === 200 || response.status === 201) {
                history.push('/home');
            } else {
                //return to login if unsuccessful
                history.push('/login');
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
            <form method="post" onSubmit={handleSubmit}>
                <input className="input-box" type="text" name="username" placeholder="Username" required />
                <input className="input-box" type="password" name="password" placeholder="Password" required />
                <input className="submit" type="submit" value="Login" />
            </form>
        </div>
    );
}

export default Login;
