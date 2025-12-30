import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Privacy = () => {
    document.title = "Privacy";
    
    return (
        <div className="welcome-container">
            <p className="welcome-text">Privacy</p>
            <div className="join-login">
                <Link to="/welcome">
                    <button className="button join welcome">Back</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div className="team-content">
                <div className="left-aligned-text">
                    <p className="welcome-box-header">Your personal data does not leave Aether Social</p>
                    <p style={{ fontSize: 'clamp(14px, 2.5vw, 20px)', fontWeight: '600', marginBottom: 'var(--small-margin)' }}>
                        Sensitive information, such as passwords and private messages, are encrypted.
                    </p>
                </div>
                <div className="left-aligned-text">
                    <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.85)' }}>
                        Full privacy policy coming soon.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;