import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const EmailVerification = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); 
    const [message, setMessage] = useState('');
    
    useEffect(() => {
        const verifyEmail = async () => {
            const token = searchParams.get('token');
            if (!token) {
                setStatus('error');
                setMessage('Invalid verification link');
                return;
            }
            try {
                const response = await axios.get(`/api/verify-email?token=${token}`);
                setStatus('success');
                setMessage(response.data.message);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Verification failed');
            }
        };
        verifyEmail();
    }, [searchParams, navigate]);
    
    return (
        <div className="authentication-container">
            <div className="authentication-box">
                <h1>Email Verification</h1>
                {status === 'verifying' && (
                    <div>
                        <p>Verifying your email...</p>
                        <div className="spinner"></div>
                    </div>
                )}
                {status === 'success' && (
                    <div>
                        <p className="success-message">{message}</p>
                        <p>Redirecting to login...</p>
                    </div>
                )}
                {status === 'error' && (
                    <div>
                        <p className="error-message">{message}</p>
                        <button onClick={() => navigate('/login')}>
                            Go to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailVerification;