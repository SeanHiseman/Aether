import api from '../../api';
import { AuthContext } from '../../components/authContext';
import { Link } from "react-router-dom";
import { useContext, useState } from 'react';
import { ValidateTextInput } from '../../functions/validateTextInput';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const Feedback = () => {
    const [error, setError] = useState('');
    const { isAuthenticated } = useContext(AuthContext);
	const [messageText, setMessageText] = useState('');
	const messageCheck = ValidateTextInput(messageText, 1, 5000, false);
    const isDisabled = !messageText || !messageCheck.valid || !isAuthenticated;
    const [responseMessage, setResponseMessage] = useState('');

	const handleSubmit = async event => {
		event.preventDefault();
		try {
            if (!isAuthenticated) return;
			await api.post('/feedback', {
				message: messageText,
			});
			setResponseMessage('Thank you for your feedback!');
            setTimeout(() => setResponseMessage(''), 5000);
			setError('');
			setMessageText('');
		} catch (error) {                     
			setResponseMessage('');
			setError(error.response?.data?.message || 'Failed to submit feedback.');
		}
	};

	return (
		<div className="authentication-container">
			<p className="welcome-text">Feedback</p>
            <p className="small-text">Let us know how to improve</p>
			<div className="authentication-box">
				<p className="error-message" style={{ marginBottom: '20px' }}>
					{error || responseMessage || messageCheck.error}
				</p>
				<form onSubmit={handleSubmit}>
					<textarea
						className="form-textarea"
						placeholder="Your feedback..."
						value={messageText}
						onChange={e => setMessageText(e.target.value)}
					/>
					<input
						className={`submit${isDisabled ? ' disabled' : ''}`}
						disabled={isDisabled}
						type="submit"
						value="Send Feedback"
					/>
				</form>
				<Link to={-1}>
					<p className="small-text">Back</p>
				</Link>
			</div>
		</div>
	);
};

export default Feedback;