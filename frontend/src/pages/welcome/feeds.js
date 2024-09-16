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
                    <p className="welcome-box-header">Dynamic feeds</p>
                    <p>All posts are made to feeds. Each feed is divided into channels. Main channels display content from across the feed, so nothing is missed</p>
                    <div className="spacer20px"/>
                    <p>Feeds are dynamic. They can join together into larger feeds, or split in to smaller feeds. Alongside posts, each channel has chats</p>
                    <div className="spacer20px"/>
                    <p>Users have their own feeds where only they can post content</p>
                </div>
            </div>
        </div>
    );
};

export default Feeds;