import api from "../../api";
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import "../../css/authentication.css";
import "../../css/baseLayout.css";

const ConnectBluesky = () => {
	const [handle, setHandle] = useState('');
	const [appPassword, setAppPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const navigate = useNavigate();
	const isDisabled = !handle || !appPassword || isSubmitting;

	const submit = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);
		setErrorMessage('');
		
		try {
			const response = await api.post('/auth/bluesky', {
				identifier: handle,
				appPassword
			});
			if (response.data?.success) {
				//Update connected accounts in localStorage
				const existing = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
				const updated = [
					...existing.filter(acc => acc.platform !== "bluesky"),
					{
						platform: "bluesky",
						handle,
						instance_url: "https://bsky.social",
						extra: { did: response.data?.did }
					}
				];
				localStorage.setItem("connectedAccounts", JSON.stringify(updated));
				//Store posts in sessionStorage BEFORE navigating
				const cacheKey = 'bluesky_initial_posts';
				sessionStorage.setItem(cacheKey, JSON.stringify(response.data.posts));
				navigate('/feed/bluesky?connected=true');
				return;
			}
			setErrorMessage('Could not connect to Bluesky');
		} catch (error) {
			const message = error.response?.data?.error || 'Error connecting to Bluesky';
			setErrorMessage(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	document.title = "Connect Bluesky";
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