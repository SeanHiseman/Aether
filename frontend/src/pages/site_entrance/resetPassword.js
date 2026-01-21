import api from '../../api';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const ResetPassword = () => {
	const [confirmPassword, setConfirmPassword] = useState('');
	const [message, setMessage] = useState('');
	const [password, setPassword] = useState('');
	const location = useLocation();
	const token = new URLSearchParams(location.search).get('token');

	const handleSubmit = async event => {
		event.preventDefault();
		try {
			const { data } = await api.post('/reset-password', { password, token });
			setMessage(data?.message);
		} catch (error) {
			if (error.response?.status === 400) {
				setMessage(error.response?.data?.message);
			} else {
				setMessage('Failed to reset password. Please try again.');
			}
			setTimeout(() => setMessage(''), 5000);
		}
	};

	document.title = 'Reset Password';
	return (
		<div className="authentication-container">
			<p className="welcome-text">Set New Password</p>
			<div className="authentication-box">
				<p className="error-message">{message}</p>
				<form onSubmit={handleSubmit}>
					<input
						className="authentication-input-box"
						name="password"
						placeholder="New password"
						required
						type="password"
						value={password}
						onChange={e => {
							const input = e.target.value;
							if (input.length <= 50) {
								setPassword(input);
								setMessage('');
							} else {
								setMessage('Password cannot exceed 50 characters');
							}
						}}
					/>
					<input
						className="authentication-input-box"
						name="confirmPassword"
						placeholder="Confirm new password"
						required
						type="password"
						value={confirmPassword}
						onChange={e => {
							const input = e.target.value;
							if (input.length <= 50) {
								setConfirmPassword(input);
								if (password && input !== password) {
									setMessage('Passwords do not match');
								} else {
									setMessage('');
								}
							} else {
								setMessage('Password cannot exceed 50 characters');
							}
						}}
					/>
				    <input
						className={
							'submit' +
							((!password || !confirmPassword || password !== confirmPassword) ? ' disabled' : '')
						}
                        disabled={!password || !confirmPassword || password !== confirmPassword}
                        title={message}
						type="submit"
						value="Reset Password"
					/>
				</form>
				<Link to="/login">
                    <p className="small-text">Back to Login</p>
                </Link>
			</div>
		</div>
	);
};

export default ResetPassword;