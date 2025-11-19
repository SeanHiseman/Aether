export default function DisconnectSocialButton({ socialIcon, socialName, platform, onRequestDisconnect }) {
	return (
		<button className="small-icon" onClick={() => onRequestDisconnect(platform, socialName)}>
			<img className="social-icon" src={socialIcon} onError={(e) => e.currentTarget.src = '/media/site_images/Logo.png'} />
			<p className="icon-text">{socialName}</p>
		</button>
	);
}