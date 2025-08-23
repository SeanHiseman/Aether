import axios from 'axios';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ValidateEmail } from '../../functions/validateEmail';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const ForgotPassword = () => {
	const [email, setEmail] = useState('');
	const [emailError, setEmailError] = useState('');
	const [message, setMessage] = useState('');
	const isDisabled = !email || emailError;

	const handleSubmit = async event => {
		event.preventDefault();
		try {
			await axios.post('/api/forgot-password', { email });
			setMessage(`Password reset sent to ${email}.`);
		} catch (error) {
			setMessage(error.response?.data?.message || 'Failed to send reset instructions. Please try again.');
		}
	};

	return (
		<div className="authentication-container">
			<p className="welcome-text">Forgot password</p>
			<div className="authentication-box">
				<p className="error-message">{message || emailError}</p>
				<form onSubmit={handleSubmit}>
					<input
						className="authentication-input-box"
						name="email"
						placeholder="Email address"
						required
						value={email}
						onChange={e => {
							const input = e.target.value;
							setEmail(input);
							const { valid, error } = ValidateEmail(input);
							setEmailError(valid ? '' : error);
						}}
						onBlur={e => {
							const input = e.target.value;
							if (input) {
								const { valid, error } = ValidateEmail(input);
								setEmailError(valid ? '' : error);
							}
						}}
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