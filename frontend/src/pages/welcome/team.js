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
                <div className="left-aligned-text">
                    <p className="welcome-box-header">Founder & Developer</p>
                    <p style={{ 
                        fontSize: 'clamp(14px, 2.5vw, 20px)', 
                        fontWeight: '600',
                        marginBottom: 'var(--small-margin)',
                        color: '#6a6aff'
                    }}>
                        Sean Hiseman
                    </p>
                </div>
                <div className="left-aligned-text">
                    <p style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.85)' }}>
                        Special thanks to Satwik Goyal, Esteban Russi, and Masood Entrepreneurship Centre
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Team;