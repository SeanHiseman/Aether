import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Support = () => {
    document.title = "Support";
    
    return (
        <div className="welcome-container">
            <p className="welcome-text">Support</p>
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
                    <p className="welcome-box-header">Need help? Let us know at:</p>
                    <p style={{ 
                        fontSize: 'clamp(14px, 2.5vw, 20px)', 
                        fontWeight: '600',
                        marginBottom: 'var(--small-margin)',
                    }}>
                        support@aethersocial.com
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Support;