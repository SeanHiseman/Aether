import api from "../../api";
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import "../../css/authentication.css";
import "../../css/baseLayout.css";

const ConnectMastodon = () => {
	const [instance, setInstance] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const navigate = useNavigate();

	const submit = async (e) => {
		e.preventDefault();
		try {
			const resp = await api.post('/auth/mastodon', { instance });
			if (resp.data?.url) {
				window.location.href = resp.data.url;
				return;
			}
			setErrorMessage('Could not start Mastodon login');
		} catch (error) {
			setErrorMessage('Error connecting to Mastodon');
		}
	};

	return (
		<div className="authentication-container">
			<p className="welcome-text">Connect Mastodon</p>
			<div className="authentication-box">
				<p className="large-text">Mastodon Login</p>
				<p className="error-message">{errorMessage}</p>
				<form onSubmit={submit}>
					<p className="small-text faded-text">
						Enter the Mastodon server where your account lives.
					</p>
					<input
						className="authentication-input-box"
						placeholder="e.g. mastodon.social"
						value={instance}
						required
						onChange={(e) => setInstance(e.target.value.trim())}
					/>
					<input
						type="submit"
						value="Connect Mastodon"
						className={`submit${!instance ? ' disabled' : ''}`}
						disabled={!instance}
					/>
				</form>
			</div>
		</div>
	);
};

export default ConnectMastodon;