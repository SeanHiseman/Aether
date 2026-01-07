import api from '../../api';
import { useEffect, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ValidateEmail } from '../../functions/validateEmail';
import { ValidateTextInput } from '../../functions/validateTextInput';
import '../../css/authentication.css'; 
import '../../css/basicStyles.css';

const Join = () => {
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [username, setUsername] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const emailValidation = ValidateEmail(email);
    const isDisabled = !confirmPassword || !email || !password || !username || !emailValidation.valid || password !== confirmPassword || Boolean(errorMessage);

    const handleGoogleLogin = () => {
        window.location.href = `${window.location.origin}/api/auth/google`;
    };

    const handleJoin = async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const username = event.target.username.value;
        try {
            const response = await api.post('/join', { email, password, username });
            if (response.data?.success) {
                setErrorMessage('');
                navigate('/verify-email');
            }
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;
            if (status === 409) {
                setErrorMessage(data?.message);
            } else if (status === 400) {
                if (data?.field === 'username') {
                    setErrorMessage(`Username: ${data.message}`);
                } else if (data?.field === 'email') {
                    setErrorMessage(`Email: ${data.message}`);
                } else {
                    setErrorMessage(data?.message || 'Invalid input');
                }
            } else {
                setErrorMessage('Joining failed, please try again');
            }
        }
    };

    const togglePasswordVisibility = (setter, currentState) => {
        setter(!currentState);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('error') === 'auth_failed') {
            setErrorMessage('Google authentication failed. Please try again.');
        }
    }, [location]);

    document.title = "Join";
    return (
        <div className="authentication-container">
            <Link to="/welcome">
                <p className="welcome-text pointer">Welcome to Aether Social</p>
            </Link>
            <div className="authentication-box">
                <div className="login-register">
                    <p className="large-text">Join</p>
                    <Link to="/login">
                        <p className="link">Login</p>
                    </Link>
                </div>
                <p className="error-message">{errorMessage}</p>
                <button type="button" onClick={handleGoogleLogin} className="google-oauth-button" style={{ width: '100%' }}>
                    <FcGoogle size={20} />
                    <span>Join with Google</span>
                </button>
                <div className="divider-container">
                    <div className="divider-line" />
                    <span className="divider-text">or</span>
                    <div className="divider-line" />
                </div>
                <form method="post" onSubmit={handleJoin}>
                <input
                    className="authentication-input-box"
                    name="username"
                    placeholder="Username"
                    required
                    value={username}
                    onChange={(e) => {
                        const input = e.target.value;
                        if (input.length <= 30) {
                            setUsername(input);
                            if (input) {
                                const result = ValidateTextInput(input, 3, 30);
                                if (result.valid) {
                                    setErrorMessage("");
                                } else {
                                    setErrorMessage(result.error);
                                }
                            } else {
                                setErrorMessage("");
                            }
                        } else {
                            setErrorMessage("Username cannot exceed 30 characters");
                        }
                    }}
                />
                    <input
                        type="email"
                        className="authentication-input-box"
                        name="email"
                        placeholder="Email"
                        required
                        value={email}
                        onChange={(e) => {
                            const input = e.target.value;
                            if (input.length <= 320) {
                                setEmail(input);
                                if (input) {
                                    const result = ValidateEmail(input);
                                    if (result.valid) {
                                        setErrorMessage("");
                                    } else {
                                        setErrorMessage(result.error);
                                    }
                                } else {
                                    setErrorMessage("");
                                }
                            } else {
                                setErrorMessage("Email cannot exceed 320 characters");
                            }
                        }}
                        onBlur={(e) => {
                            if (e.target.value) {
                                const result = ValidateEmail(e.target.value);
                                if (!result.valid) {
                                    setErrorMessage(result.error);
                                }
                            }
                        }}
                    />
                    <div className="password-container">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            className="authentication-input-box" 
                            name="password" 
                            placeholder="Password" 
                            required 
                            value={password}
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 50) {
                                    setPassword(input);
                                    if (confirmPassword && input !== confirmPassword) {
                                        setErrorMessage("Passwords do not match");
                                    } else if (confirmPassword && input === confirmPassword) {
                                        setErrorMessage("");
                                    }
                                } else {
                                    setErrorMessage("Password cannot exceed 50 characters");
                                }
                            }} 
                        />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowPassword, showPassword)} title={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <div className="password-container">
                        <input 
                            type={showConfirmPassword ? "text" : "password"} 
                            className="authentication-input-box" 
                            name="confirm-password" 
                            placeholder="Re-enter password" 
                            required 
                            value={confirmPassword}
                            onChange={(e) => {
                                const input = e.target.value;
                                if (input.length <= 50) {
                                    setConfirmPassword(input);
                                    if (password && input !== password) {
                                        setErrorMessage("Passwords do not match");
                                    } else if (password && input === password) {
                                        setErrorMessage("");
                                    }
                                } else {
                                    setErrorMessage("Password cannot exceed 50 characters");
                                }
                            }} 
                        />
                        <button type="button" className="small-icon" onClick={() => togglePasswordVisibility(setShowConfirmPassword, showConfirmPassword)} title={showConfirmPassword ? "Hide password" : "Show password"}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input className={`submit${isDisabled ? ' disabled' : ''}`} disabled={isDisabled} type="submit" value="Join" />
                </form>
            </div>
        </div>
    );
}

export default Join;