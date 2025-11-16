const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';

export default function ConnectSocialButton({ socialIcon, socialName, socialRoute }) {
	const handleClick = async () => {
		if (socialRoute === '/connect/bluesky') {
			window.location.href = socialRoute;
			return;
		}
		if (socialRoute === '/connect/mastodon') {
			const instance = prompt("Enter your Mastodon instance (e.g. mastodon.social)");
			if (!instance) return;
			const response = await fetch(`${backendUrl}/api/auth/mastodon`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ instance })
			});
			const json = await response.json();
			if (json?.url) {
				window.location.href = json.url;
			}
			return;
		}
		window.location.href = `${backendUrl}/api/${socialRoute}`;
	};

	return (
		<button className="small-icon" onClick={handleClick}>
			<img className="social-icon" src={socialIcon} onError={(e) => e.currentTarget.src = '/media/site_images/Logo.png'} />
			<p className="icon-text">{socialName || "Undefined social media"}</p>
		</button>
	)
}