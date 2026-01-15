import api from '../../api';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ValidateEmail } from '../../functions/validateEmail';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const EmailVerification = () => {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [message, setMessage] = useState('');
    const [showTempMessage, setShowTempMessage] = useState(false);
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying');
    const navigate = useNavigate();

    useEffect(() => {
        const verifyEmail = async () => {
            const token = searchParams.get('token');
            if (!token) {
                setStatus('pending');
                setMessage('Email verification sent.');
                return;
            }
            try {
                const response = await api.get(`/verify-email?token=${token}`);
                setStatus('success');
                setMessage(response.data?.message);
                if (response.data?.success) {
                    localStorage.setItem('user', JSON.stringify(response.data?.user));
                }
                setTimeout(() => {
                    navigate('/help');
                }, 3000);
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Verification failed');
            }
        };
        verifyEmail();
    }, [navigate, searchParams]);

    const handleResend = async (event) => {
        event.preventDefault();
        try {
            const response = await api.post('/resend-verification', { email });
            setStatus('info');
            setMessage(response.data?.message);
            setShowTempMessage(true);
            setTimeout(() => setShowTempMessage(false), 5000);
        } catch (error) {
            let msg = 'Resend failed';
            if (error.response) {
                if (error.response?.status === 429) {
                    msg = error.response.data || msg;
                } else {
                    msg = error.response.data?.message || msg;
                }
            }
            setStatus('error');
            setMessage(msg);
            setShowTempMessage(true);
            setTimeout(() => setShowTempMessage(false), 5000);
        }
    };

    return (
        <div className="authentication-container">
            <p className="welcome-text pointer">Email Verification</p>
            <p className="small-text">Check your email, including spam, for a verification link</p>
            <div className="authentication-box">
                {status === 'verifying' && (
                    <div>
                        <p>Verifying your email...</p>
                        <div className="spinner"></div>
                    </div>
                )}
                {showTempMessage && <p>{message}</p>}
                <form onSubmit={handleResend}>
                    <p className="error-message">{emailError}</p>
                    <input
                        className="authentication-input-box"
                        name="email"
                        placeholder="Your email"
                        required
                        value={email}
                        onChange={(e) => {
                            const input = e.target.value;
                            setEmail(input);
                            const { valid, error } = ValidateEmail(input);
                            setEmailError(valid ? '' : error);
                        }}
                        onBlur={(e) => {
                            const input = e.target.value;
                            if (input) {
                                const { valid, error } = ValidateEmail(input);
                                setEmailError(valid ? '' : error);
                            }
                        }}
                    />
                    <button
                        className="button"
                        type="submit"
                        disabled={!email || emailError}
                    >
                        Resend Verification Email
                    </button>
                </form>
                {status === 'success' && (
                    <div>
                        <p className="success-message">{message}</p>
                        <p className="small-text faded-text">Logging you in...</p>
                    </div>
                )}
                {status === 'error' && (
                    <div>
                        <p className="error-message">{message}</p>
                        <button className="button" onClick={() => navigate('/login')}>
                            Go to Login
                        </button>
                    </div>
                )}
                <Link to="/login">
                    <p className="small-text">Back to Login</p>
                </Link>
            </div>
        </div>
    );
};

export default EmailVerification;