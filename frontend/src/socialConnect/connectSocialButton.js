import axios from 'axios';

export default function ConnectSocialButton({ socialIcon, socialName, socialRoute }) {
	const handleClick = async () => {
		if (!socialRoute) return;
		if (socialRoute === '/connect/bluesky') {
			window.location.href = socialRoute;
			return;
		}
		if (socialRoute === '/connect/mastodon') {
			const instance = prompt("Enter your Mastodon instance (e.g. mastodon.social)");
			if (!instance) return;
			const response = await axios.post(`/api/auth/mastodon`, { instance });
			const json = response.data;
			if (json?.url) {
				window.location.href = json.url;
			}
			return;
		}
		window.location.href = `/api/${socialRoute}`;
	};

	return (
		<button className="small-icon" onClick={handleClick}>
			<img className="social-icon" src={socialIcon} onError={(e) => e.currentTarget.src = '/media/site_images/Logo.png'} />
			<p className="icon-text">{socialName || "Undefined social media"}</p>
		</button>
	)
}