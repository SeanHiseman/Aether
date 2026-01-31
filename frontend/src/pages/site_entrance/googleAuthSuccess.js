import { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import api from '../../api';
import { ThemeContext } from '../../themeProvider';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const GoogleAuthSuccess = () => {
    const navigate = useNavigate();
    const { refreshTheme } = useContext(ThemeContext);
    const [searchParams] = useSearchParams();
    const [error, setError] = useState('');

    useEffect(() => {
        const handleGoogleAuth = async () => {
            const errorParam = searchParams.get('error');
            if (errorParam) {
                setError('Authentication failed. Please try again.');
                setTimeout(() => navigate('/login'), 2000);
                return;
            }
            try {
                const response = await api.get('/auth/google/data');
                if (response.data?.success) {
                    localStorage.setItem("algorithms", JSON.stringify(response.data?.algorithms || []));
                    localStorage.setItem("blueskyFollows", JSON.stringify(response.data?.blueskyFollows || []));
                    localStorage.setItem("connectedAccounts", JSON.stringify(response.data?.connectedAccounts || []));
                    localStorage.setItem("deepFeeds", JSON.stringify(response.data?.deepFeeds || []));
                    localStorage.setItem("followedFeeds", JSON.stringify(response.data?.followedFeeds || []));
                    localStorage.setItem("recentUpvotes", JSON.stringify(response.data?.recentUpvotes || []));
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
                    const isNewUser = response.data?.user?.is_new_user === true;
                    const storedPath = sessionStorage.getItem('authRedirectPath');
                    sessionStorage.removeItem('authRedirectPath');
                    const excludedPaths = ['/login', '/join', '/register', '/welcome', '/auth', '/verify-email', '/forgot-password', '/reset-password'];
                    const isExcluded = excludedPaths.some(path => storedPath?.startsWith(path));
                    let redirectPath = '/explore';
                    if (isNewUser) { //Go to profile setup on first login
                        redirectPath = '/profile-setup';
                    } else if (storedPath && !isExcluded) {
                        redirectPath = storedPath;
                    }
                    navigate(redirectPath, { replace: true });
                } else {
                    setError('Failed to complete authentication');
                    setTimeout(() => navigate('/login'), 2000);
                }
            } catch (error) {
                setError('Authentication failed. Please try again.');
                setTimeout(() => navigate('/login'), 2000);
            }
        };

        handleGoogleAuth();
    }, [navigate, refreshTheme, searchParams]);

    return (
        <div className="authentication-container">
            <div className="authentication-box" style={{ textAlign: 'center', padding: '40px' }}>
                {error ? (
                    <>
                        <p style={{ color: '#e74c3c', marginBottom: '20px', fontSize: '16px' }}>{error}</p>
                        <p style={{ color: '#666' }}>Redirecting to login...</p>
                    </>
                ) : (
                    <>
                        <div className="auth-success-icon" style={{ marginBottom: '20px' }}>
                            <FcGoogle size={48} />
                        </div>
                        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
                            Completing authentication...
                        </p>
                        <div className="spinner" />
                    </>
                )}
            </div>
        </div>
    );
};

export default GoogleAuthSuccess;