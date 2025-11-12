const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';

export default function ConnectRedditButton() {
	const handleClick = () => {
		window.location.href = `${backendUrl}/api/auth/reddit`;
	};
	return <button className="main-button" onClick={handleClick}>Connect Reddit</button>;
}