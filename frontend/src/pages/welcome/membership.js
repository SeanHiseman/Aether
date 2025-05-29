import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Membership = () => {

    document.title="Membership";
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
                    <p className="welcome-box-header">Membership</p>
                    <p>Get more access to better models for creating dynamic posts</p>
                    <div className="spacer20px"/>
                    <p>Create longer, more detailed posts</p>
                    <div className="spacer20px"/>
                    <div className="spacer20px"/>
                    <p>Coming soon: Voting for mods and admins, revenue sharing, HD content, enhanced customisations</p>
                    <p></p>
                </div>
            </div>
        </div>
    );
};

export default Membership;