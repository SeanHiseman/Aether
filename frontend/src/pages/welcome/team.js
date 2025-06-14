import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Team = () => {
    document.title = "Aether Team";
    
    return (
        <div id="welcome-container">
            <p id="welcome-text">Welcome to Aether</p>
            <p className="text24">Better social media</p>
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
                    <p className="welcome-box-header">Our Team</p>
                    <p>Built by Sean Hiseman and Satwik Goyal</p>
                </div>
            </div>
        </div>
    );
};

export default Team;