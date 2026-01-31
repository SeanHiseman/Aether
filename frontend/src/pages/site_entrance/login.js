import api from '../../api';
import { useContext, useEffect, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaEye, FaEyeSlash } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../../themeProvider';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const Login = () => {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const { refreshTheme } = useContext(ThemeContext);
    const [showPassword, setShowPassword] = useState(false);
    const [showBlueskyForm, setShowBlueskyForm] = useState(false);
    const [blueskyHandle, setBlueskyHandle] = useState('');
    const [blueskyAppPassword, setBlueskyAppPassword] = useState('');
    const [showBlueskyPassword, setShowBlueskyPassword] = useState(false);
    const [blueskyLoading, setBlueskyLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const isDisabled = !password || !usernameOrEmail;
    const isBlueskyDisabled = !blueskyHandle || !blueskyAppPassword || blueskyLoading;

    const handleLogin = async (event) => {
        event.preventDefault();
        try {
            const response = await api.post('/login', { password, usernameOrEmail }); //Username can also be email
            if (response.data?.success) {
                localStorage.setItem("algorithms", JSON.stringify(response.data?.algorithms || []));
                localStorage.setItem("blueskyFollows", JSON.stringify(response.data?.blueskyFollows || []));
                localStorage.setItem("mastodonFollows", JSON.stringify(response.data?.mastodonFollows || []));
                localStorage.setItem("connectedAccounts", JSON.stringify(response.data?.connectedAccounts || []));
                localStorage.setItem("connections", JSON.stringify(response.data?.connections || []));
                localStorage.setItem("connectionChats", JSON.stringify(response.data?.connectionChats || {}));
                localStorage.setItem("deepFeeds", JSON.stringify(response.data?.deepFeeds || []));
                localStorage.setItem("followedFeeds", JSON.stringify(response.data?.followedFeeds));
                localStorage.setItem("recentUpvotes", JSON.stringify(response.data?.recentUpvotes));
                localStorage.setItem("savedChannels", JSON.stringify(response.data?.savedChannels || []));
                localStorage.setItem("user", JSON.stringify(response.data?.user));
                //Store feed channels
                const feedChannels = response.data?.feedChannels || {};
                Object.keys(feedChannels).forEach(feedId => {
                    localStorage.setItem(`feedChannels_${feedId}`, JSON.stringify(feedChannels[feedId]));
                });
                //Store channel view history for unread indicators
                const channelViews = response.data?.channelViews || {};
                localStorage.setItem('feedChannelViews', JSON.stringify(channelViews));
                await refreshTheme();
                const from = location.state?.from || '/explore';
                navigate(from, { replace: true });
            }
        } catch (error) {
            const message = error.response?.data?.message;
            setErrorMessage(message || 'Error logging in');
            setTimeout(() => setErrorMessage(''), 5000);
            if (message && message.includes('verify your email')) {
                navigate(`/verify-email`);
            }
        }
    };

    const handleBlueskyLogin = async (event) => {
        event.preventDefault();
        setBlueskyLoading(true);
        try {
            const response = await api.post('/auth/bluesky/login', {
                identifier: blueskyHandle,
                appPassword: blueskyAppPassword
            });
            if (response.data?.success) {
                localStorage.setItem("algorithms", JSON.stringify(response.data?.algorithms || []));
                localStorage.setItem("blueskyFollows", JSON.stringify(response.data?.blueskyFollows || []));
                localStorage.setItem("connectedAccounts", JSON.stringify(response.data?.connectedAccounts || []));
                localStorage.setItem("deepFeeds", JSON.stringify(response.data?.deepFeeds || []));
                localStorage.setItem("followedFeeds", JSON.stringify(response.data?.followedFeeds || []));
                localStorage.setItem("recentUpvotes", JSON.stringify(response.data?.recentUpvotes || []));
                localStorage.setItem("savedChannels", JSON.stringify(response.data?.savedChannels || []));
                localStorage.setItem("user", JSON.stringify(response.data?.user));
                // Store feed channels
                const feedChannels = response.data?.feedChannels || {};
                Object.keys(feedChannels).forEach(feedId => {
                    localStorage.setItem(`feedChannels_${feedId}`, JSON.stringify(feedChannels[feedId]));
                });
                // Store channel view history for unread indicators
                const channelViews = response.data?.channelViews || {};
                localStorage.setItem('feedChannelViews', JSON.stringify(channelViews));
                await refreshTheme();
                const isNewUser = response.data?.user?.is_new_user;
                const from = isNewUser ? '/help' : (location.state?.from || '/explore');
                navigate(from, { replace: true });
            }
        } catch (error) {
            const message = error.response?.data?.message;
            setErrorMessage(message || 'Invalid Bluesky credentials');
            setTimeout(() => setErrorMessage(''), 5000);
        } finally {
            setBlueskyLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = `${window.location.origin}/api/auth/google`;
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

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('error') === 'auth_failed') {
            setErrorMessage('Google authentication failed. Please try again.');
        }
    }, [location]);

    document.title = "Login";
    return (
        <div className="authentication-container">
            <Link to="/welcome">
                <p className="welcome-text pointer">Welcome to Aether Social</p>
            </Link>
            <div className="authentication-box">
                <div className="login-register">
                    <p className="large-text">Login</p>
                    <Link to="/join">
                        <p className="link">Join</p>
                    </Link>
                </div>
                <p className="error-message">{errorMessage}</p>
                <button type="button" onClick={handleGoogleLogin} className="google-oauth-button" style={{ width: '100%' }}>
                    <FcGoogle size={20} />
                    <span>Login with Google</span>
                </button>
                <button type="button" onClick={() => setShowBlueskyForm(!showBlueskyForm)} className="bluesky-oauth-button" style={{ width: '100%', marginTop: '10px' }}>
                    <img src="/media/site_images/social_sites/bluesky-logo.png" alt="Bluesky" style={{ width: 20, height: 20 }} />
                    <span>Login with Bluesky</span>
                    {showBlueskyForm ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                </button>
                {showBlueskyForm && (
                    <form className="bluesky-form" onSubmit={handleBlueskyLogin}>
                        <input
                            className="authentication-input-box"
                            name="bluesky-handle"
                            placeholder="Bluesky handle (e.g. user.bsky.social)"
                            value={blueskyHandle}
                            onChange={(e) => setBlueskyHandle(e.target.value)}
                        />
                        <div className="password-container">
                            <input
                                type={showBlueskyPassword ? "text" : "password"}
                                className="authentication-input-box"
                                name="bluesky-password"
                                placeholder="App password (recommended)"
                                value={blueskyAppPassword}
                                onChange={(e) => setBlueskyAppPassword(e.target.value)}
                            />
                            <button type="button" className="small-icon" onClick={() => setShowBlueskyPassword(!showBlueskyPassword)}>
                                {showBlueskyPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                        <p className="tiny-text faded-text">
                            For security, use an app password. Create one at <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">bsky.app/settings/app-passwords</a>
                        </p>
                        <input
                            className={`submit${isBlueskyDisabled ? ' disabled' : ''}`}
                            disabled={isBlueskyDisabled}
                            type="submit"
                            value={blueskyLoading ? "Logging in..." : "Login with Bluesky"}
                        />
                    </form>
                )}
                <div className="divider-container">
                    <div className="divider-line" />
                    <span className="divider-text">or</span>
                    <div className="divider-line" />
                </div>
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
                        <button type="button" className="small-icon" onClick={togglePasswordVisibility} title={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    <input className={`submit${isDisabled ? ' disabled' : ''}`} disabled={isDisabled} type="submit" value="Login" />
                    <Link to="/forgot-password">
                        <p className="small-text underline">Forgot password?</p>
                    </Link>
                </form>
            </div>
        </div>
    );
}

export default Login;