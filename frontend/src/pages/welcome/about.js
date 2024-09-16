import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const About = () => {

    document.title="About";
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
                    <p className="welcome-box-header">About Aether</p>
                    <p>Aether's mission is to be the best social media website</p>
                    <div className="spacer20px"/>
                    <p>Currently, platforms exist to grab attention for viewing ads. They are often filled with clickbait, anger and misinformation. We believe social media can be better than this</p>
                    <div className="spacer20px"/>
                    <p>With no advertising, we have no need to serve addictive content. Instead, our aim is maximise how meaningfully time is spent on our site</p>
                    <div className="spacer20px"/>
                    <p>All users can earn money from their posts, without needing to serve advertisers or be a big creator. Most revenue from memberships is shared with the community, with votes and view deciding how much each post earns</p>
                    <div className="spacer20px"/>
                </div>
            </div>
        </div>
    );
};

export default About;