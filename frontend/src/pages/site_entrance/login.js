import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../../themeProvider';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const Login = () => {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const { refreshTheme } = useContext(ThemeContext);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const isDisabled = !password || !usernameOrEmail;

    const handleLogin = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/login', { password, usernameOrEmail }); //Username can also be email
            if (response.data?.success) {
                localStorage.setItem("followedFeeds", JSON.stringify(response.data?.followedFeeds));
                localStorage.setItem("deepFeeds", JSON.stringify(response.data?.deepFeeds || []));
                localStorage.setItem("user", JSON.stringify(response.data?.user));
                localStorage.setItem("recentUpvotes", JSON.stringify(response.data?.recentUpvotes));
                await refreshTheme();
                navigate('/explore'); 
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error logging in');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    //Helps with autofill
    useEffect(() => {
        const usernameInput = document.querySelector('input[name="username"]');
        const passwordInput = document.querySelector('input[name="password"]');
        setTimeout(() => {
            if (usernameInput?.value && !usernameOrEmail) setUsernameOrEmail(usernameInput.value);
            if (passwordInput?.value && !password) setPassword(passwordInput.value);
        }, 300);
    }, []);

    document.title = "Login";
    return (
        <div className="authentication-container">
            <p className="welcome-text">Welcome back</p>
            <div className="authentication-box">
                <div className="login-register">
                    <p className="large-text">Login</p>
                    <Link to="/join">
                        <p className="link">Join</p>
                    </Link>
                </div>
                <p className="error-message">{errorMessage}</p>
                <form method="post" autoComplete="on" onSubmit={handleLogin}>
                    <input
                        className="authentication-input-box"
                        name="username"
                        autoComplete="username"
                        placeholder="Username or email"
                        required
                        value={usernameOrEmail}
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= 320) {
                                setUsernameOrEmail(input);
                                setErrorMessage('');
                            } else {
                                setErrorMessage('Cannot exceed 320 characters');
                            }
                        }}
                    />
                    <div className="password-container">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="authentication-input-box"
                            name="password"
                            autoComplete="current-password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 50) {
                                    setPassword(input);
                                    setErrorMessage('');
                                } else {
                                    setErrorMessage('Password cannot exceed 50 characters');
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="small-icon"
                            onClick={togglePasswordVisibility}
                            title={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input
                        className={`submit${isDisabled ? ' disabled' : ''}`}
                        disabled={isDisabled}
                        type="submit"
                        value="Login"
                    />
                    <Link to="/forgot-password">
                        <p className="small-text">Forgot password?</p>
                    </Link>
                </form>
            </div>
        </div>
    );
}

export default Login;