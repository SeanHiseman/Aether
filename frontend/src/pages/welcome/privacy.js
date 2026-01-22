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
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: 'clamp(16px, 3vw, 24px)' }}>Your personal data does not leave Aether Social</p>
                    <p style={{
                        fontSize: 'clamp(15px, 2.5vw, 18px)',
                        fontWeight: '600',
                        marginBottom: 'clamp(20px, 4vw, 32px)',
                        lineHeight: '1.6',
                        color: 'rgba(255, 255, 255, 0.9)'
                    }}>
                        Sensitive information, such as passwords and private messages, are encrypted.
                    </p>
                </div>
                <div className="content-card">
                    <p style={{
                        lineHeight: '1.7',
                        color: 'rgba(255, 255, 255, 0.85)',
                        fontSize: 'clamp(15px, 2.5vw, 18px)',
                        fontStyle: 'italic'
                    }}>
                        Full privacy policy coming soon.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;