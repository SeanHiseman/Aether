import axios from 'axios';
import React, { useContext, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../../themeProvider';
import '../../css/authentication.css'; 

const Login = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const { refreshTheme } = useContext(ThemeContext);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const password = formData.get('password');
        const username = formData.get('username');
        console.log("logging in with username: " + username);
        try {
            const response = await axios.post('/api/login', { password, username }); //username can also be email
            if (response.status === 200) {
                await refreshTheme();
                const responseUsername = response.data.username;
                navigate(`/u/${responseUsername}`);//Main feed name same as username (for now)
            } 
        } catch (error) {
            if (error.response && error.response.status === 401) {
                setErrorMessage('Invalid username or password');
            } else {
                setErrorMessage('Failed to login, please try again');
            }
        }
    };

    const togglePasswordVisibility = (event) => {
        event.preventDefault(); 
        setShowPassword(!showPassword);
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
                    <input className="authentication-input-box" name="username" placeholder="Username or email" required />
                    <div className="password-container">
                        <input type={showPassword ? "text" : "password"} className="authentication-input-box" name="password" placeholder="Password" required />
                        <button type="button" className="small-icon" onClick={togglePasswordVisibility} title={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input className="submit" type="submit" value="Login" />
                </form>
            </div>
        </div>
    );
}

export default Login;
