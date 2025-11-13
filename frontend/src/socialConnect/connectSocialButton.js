const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';

export default function ConnectSocialButton({ socialIcon, socialName, socialRoute }) {
	const handleClick = () => {
		if (socialRoute === '/connect/bluesky') {
			window.location.href = socialRoute;
		} else {
			window.location.href = `${backendUrl}/api/${socialRoute}`;
		}
	};
	return (
		<button className="small-icon" onClick={handleClick}>
			<img className="social-icon" src={socialIcon} onError={(e) => e.currentTarget.src = '/media/site_images/Logo.png'} />
			<p className="icon-text">{socialName || "Undefined social media"}</p>
		</button>
	)
}