import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Feeds = () => {

    document.title="Feeds";
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
                    <p className="welcome-box-header">Feeds</p>
                    <p>Posts are made to feeds. Each feed has channels.</p>
                    <div className="spacer20px"/>
                    <p>Feeds followed by a user can be combined together to form Deep Feeds, like folders on a computer</p>
                    <div className="spacer20px"/>
                    <p>Users have their own feeds where only they can post content</p>
                    <div className="spacer20px"/>
                    <div className="spacer20px"/>
                    <p>Coming soon: Chat channels for live group messaging</p>
                </div>
            </div>
        </div>
    );
};

export default Feeds;