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
                    <p>How you are served content should be transparent, not hidden</p>
                    <div className="spacer20px"/>
                    <p>Algotithms can be customised to consider time, previous post votes and the votes of your friends</p>
                    <div className="spacer20px"/>
                    <p>Members have advanced customisations such as specific topics, users, tone of posts and more</p>
                </div>
            </div>
        </div>
    );
};

export default Algorithm;