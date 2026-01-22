import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Placeholder = () => {
    document.title = "Coming soon";
    
    return (
        <div className="welcome-container">
            <p className="welcome-text">Welcome to Aether Social</p>
            <div className="join-login">
                <Link to="/welcome">
                    <button className="button join welcome">Back</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div className="team-content">
                <div className="content-card" style={{ textAlign: 'center' }}>
                    <p className="welcome-box-header">Coming soon...</p>
                </div>
            </div>
        </div>
    );
};

export default Placeholder;