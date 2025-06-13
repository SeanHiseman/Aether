import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const EmailVerification = () => {
	const [email, setEmail] = useState('');
	const [message, setMessage] = useState('');
	const [searchParams] = useSearchParams();
	const [status, setStatus] = useState('verifying');
	const navigate = useNavigate();
    
	useEffect(() => {
		const verifyEmail = async () => {
			const token = searchParams.get('token');
			if (!token) {
				setStatus('pending');
				setMessage('Please check your email for the verification link.');
				return;
			}
			try {
				const response = await axios.get(`/api/verify-email?token=${token}`);
				setStatus('success');
				setMessage(response.data.message);
				setTimeout(() => {
					navigate('/g/Welcome');
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
            const response = await axios.post('/api/resend-verification', { email });
            setStatus('info');
            setMessage(response.data.message);
        } catch (error) {
            let msg = 'Resend failed';
            if (error.response) {
                if (error.response.status === 429) {
                    msg = error.response.data || msg;
                } else {
                    msg = error.response.data?.message || msg;
                }
            }
            setStatus('error');
            setMessage(msg);
        }
    };

	return (
		<div className="authentication-container">
			<p className="welcome-text pointer">Email Verification</p>
			<div className="authentication-box">
				{status === 'verifying' && (
					<div>
						<p>Verifying your email...</p>
						<div className="spinner"></div>
					</div>
				)}
				{status === 'pending' && (
					<form onSubmit={handleResend}>
						<p>{message}</p>
						<input
							className="authentication-input-box"
							name="email"
							placeholder="Your email"
							required
							value={email}
							onChange={e => setEmail(e.target.value)}
						/>
						<button className="button" type="submit">Resend Verification Email</button>
					</form>
				)}
				{status === 'info' && (
					<div>
						<p>{message}</p>
					</div>
				)}
				{status === 'success' && (
					<div>
						<p className="success-message">{message}</p>
						<p>Logging you in...</p>
					</div>
				)}
				{status === 'error' && (
					<div>
						<p className="error-message">{message}</p>
						<button className="button" onClick={() => navigate('/login')}>Go to Login</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default EmailVerification;