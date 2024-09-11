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
                    <p>All posts are made to feeds. Each feed has a topic and is divided into channels. Channels combine chats and posts, allowing real time discussions alongside content</p>
                    <div className="spacer20px"/>
                    <p>Users have their own feeds where only they can post content. Main channels display content from across each feed, so nothing is missed</p>
                    <div className="spacer20px"/>
                    <p>Larger feeds can contain smaller, nested feeds</p>
                </div>
            </div>
        </div>
    );
};

export default Feeds;