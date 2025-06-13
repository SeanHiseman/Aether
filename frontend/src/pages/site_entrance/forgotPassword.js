import axios from 'axios';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const ForgotPassword = () => {
	const [email, setEmail] = useState('');
	const isDisabled = !email;
	const [message, setMessage] = useState('');

	const handleSubmit = async event => {
		event.preventDefault();
		try {
			await axios.post('/api/forgot-password', { email });
			setMessage(`Password reset sent to ${email}.`);
		} catch {
			setMessage('Failed to send reset instructions. Please try again.');
		}
	};

	return (
		<div className="authentication-container">
			<p className="welcome-text">Forgot password</p>
			<div className="authentication-box">
                <p className="error-message">{message}</p>
				<form onSubmit={handleSubmit}>
					<input
						className="authentication-input-box"
						name="email"
						placeholder="Email address"
						required
						value={email}
						onChange={e => setEmail(e.target.value)}
					/>
					<input
						className={`submit${isDisabled ? ' disabled' : ''}`}
						disabled={isDisabled}
						type="submit"
						value="Send Reset Link"
					/>
				</form>
				<Link to="/login">
					<p className="text16">Back to Login</p>
				</Link>
			</div>
		</div>
	);
};

export default ForgotPassword;