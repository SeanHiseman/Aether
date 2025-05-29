import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Algorithm = () => {

    document.title="Algorithm";
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
                    <p className="welcome-box-header">Algorithm</p>
                    <p>Custom algorithms coming Summer 2025</p>
                    <div className="spacer20px"/>
                    <p>How you are shown content should be transparent, simple, and easy to control</p>
                    <div className="spacer20px"/>
                    <p>Our vision is to build algorithms that users can customise and finely tune</p>
                    <div className="spacer20px"/>
                    <p>Users will be able to save algorithms and apply them across feeds, as well as sharing them with each other</p>
                </div>
            </div>
        </div>
    );
};

export default Algorithm;