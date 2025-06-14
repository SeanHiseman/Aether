import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const About = () => {

    document.title="About";
    return (
        <div id="welcome-container">
            <p id="welcome-text">Welcome to Aether</p>
            <p className="text24">Share anything</p>
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
                    <p className="welcome-box-header">About Aether</p>
                    <p>Aether's mission is to be the most useful social media platform</p>
                    <p>Our platform aims to give you new ways to view, create, and organise social media</p>
                    <p>This is a vision we are currently working on making a reality. Join us to take part in the future of social media</p>
                    <p>Coming soon: connect with other users to send chats and posts</p>
                </div>
            </div>
        </div>
    );
};

export default About;