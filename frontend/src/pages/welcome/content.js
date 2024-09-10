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
                    <p>Posts can combine text with multiple images and videos, creating richer and more engaging content</p>
                    <div className="spacer20px"/>
                    <p>Replies are nested and have the same format as posts, enabling dynamic and detailed discussions</p>
                    <div className="spacer20px"/>
                    <p>Members can write longer posts, up to 100,000 characters, as well as view and upload higher definition media</p>
                </div>
            </div>
        </div>
    );
};

export default Content;