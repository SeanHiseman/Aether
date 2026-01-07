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
                    localStorage.setItem("connectedAccounts", JSON.stringify(response.data?.connectedAccounts || []));
                    localStorage.setItem("deepFeeds", JSON.stringify(response.data?.deepFeeds || []));
                    localStorage.setItem("followedFeeds", JSON.stringify(response.data?.followedFeeds || []));
                    localStorage.setItem("recentUpvotes", JSON.stringify(response.data?.recentUpvotes || []));
                    localStorage.setItem("user", JSON.stringify(response.data?.user));
                    await refreshTheme();
                    const storedPath = sessionStorage.getItem('authRedirectPath');
                    sessionStorage.removeItem('authRedirectPath'); //Cleanup
                    const excludedPaths = ['/login', '/join', '/register', '/welcome', '/auth'];
                    const isExcluded = excludedPaths.some(path => 
                        storedPath?.startsWith(path)
                    );
                    //Use stored path if valid, otherwise default to /explore
                    const redirectPath = (storedPath && !isExcluded) ? storedPath : '/explore';
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