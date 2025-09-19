import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Placeholder = () => {
    document.title = "Coming soon";
    
    return (
        <div className="welcome-container">
            <p className="welcome-text">Welcome to Aether</p>
            <div id="join-login">
                <Link to="/welcome">
                    <button className="button join welcome">Back</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div className="welcome-box single">
                <div className="left-aligned-text">
                    <p className="welcome-box-header">Coming soon...</p>
                </div>
            </div>
        </div>
    );
};

export default Placeholder;