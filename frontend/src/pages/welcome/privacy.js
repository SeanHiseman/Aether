import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Privacy = () => {

    document.title="Privacy";
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
                    <p className="welcome-box-header">Privacy</p>
                    <p>You are not the product</p>
                    <div className="spacer20px"/>
                    <p>Personal data is useful to you, and you only</p>
                    <div className="spacer20px"/>
                    <p>Algorithms work better when personalised. You are in control. Ask can be used to help easily decide how your algorithms work</p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;