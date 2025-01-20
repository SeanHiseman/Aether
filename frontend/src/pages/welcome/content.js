import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Content = () => {

    document.title="Content";
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
                    <p className="welcome-box-header">Content</p>
                    <p>Create dynamic, two-way posts that the user can interact with. </p>
                    <div className="spacer20px"/>
                    <p>Combine text, image, video and interaction to build engaging and unique posts</p>
                    <div className="spacer20px"/>
                    <p>Reply to or quote other posts</p>
                </div>
            </div>
        </div>
    );
};

export default Content;