import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Team = () => {
    document.title = "Aether Team";
    
    return (
        <div className="welcome-container">
            <p className="welcome-text">Meet the Team</p>
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
                    <p className="welcome-box-header" style={{ marginBottom: 'clamp(16px, 3vw, 24px)' }}>Founder & Developer</p>
                    <p style={{
                        fontSize: 'clamp(18px, 3vw, 24px)',
                        fontWeight: '600',
                        marginBottom: 'var(--small-margin)',
                        color: 'rgba(255, 255, 255, 0.95)'
                    }}>
                        Sean Hiseman
                    </p>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: 'clamp(16px, 3vw, 24px)' }}>Acknowledgements</p>
                    <p style={{
                        lineHeight: '1.7',
                        color: 'rgba(255, 255, 255, 0.85)',
                        fontSize: 'clamp(15px, 2.5vw, 18px)'
                    }}>
                        Special thanks to Satwik Goyal, Esteban Russi, and Masood Entrepreneurship Centre
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Team;