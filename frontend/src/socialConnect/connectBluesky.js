import api from "../api";
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import "../css/authentication.css";
import "../css/baseLayout.css";

const ConnectBluesky = () => {
	const [handle, setHandle] = useState('');
	const [appPassword, setAppPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const navigate = useNavigate();
	const isDisabled = !handle || !appPassword;

	const submit = async (e) => {
		e.preventDefault();
		try {
			const response = await api.post('/auth/bluesky', {
				identifier: handle,
				appPassword
			});
			if (response.data?.success) {
				navigate('/feed/bluesky');
				return;
			}
			setErrorMessage('Could not connect to Bluesky');
		} catch (error) {
			const msg = error.response?.data?.error;
			setErrorMessage(msg || 'Error connecting to Bluesky');
		}
	};

	return (
		<div className="authentication-container">
			<p className="welcome-text">Connect Bluesky</p>
			<div className="authentication-box">
				<p className="large-text">Bluesky Login</p>
				<p className="error-message">{errorMessage}</p>
				<form method="post" onSubmit={submit}>
					<p className="small-text faded-text">Your details are sent directly to Bluesky. We do not see or store them.</p>
					<input className="authentication-input-box" placeholder="Bluesky handle (e.g. alice.bsky.social)" required value={handle} onChange={(e) => setHandle(e.target.value)} />
					<div className="password-container">
						<input type={showPassword ? 'text' : 'password'} className="authentication-input-box" placeholder="Bluesky password" required value={appPassword} onChange={(e) => setAppPassword(e.target.value)} />
						<button type="button" className="small-icon" onClick={() => setShowPassword(!showPassword)}>
							{showPassword ? <FaEyeSlash /> : <FaEye />}
						</button>
					</div>
					<input type="submit" value="Connect Bluesky" className={`submit${isDisabled ? ' disabled' : ''}`} disabled={isDisabled} />
				</form>
			</div>
		</div>
	);
};

export default ConnectBluesky;