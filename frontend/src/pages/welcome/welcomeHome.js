import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const WelcomeHome = () => {

    document.title="Welcome";
    return (
        <div id="welcome-container">
            <p id="welcome-text">Welcome to Aether</p>
            <p className="text24">Better social media</p>
            <div id="join-login">
                <Link to="/login">
                    <button className="button join welcome">Login</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div id="welcome-center">
                <div className="welcome-box">
                    <Link to="/about">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">About Aether</p>
                            <p>Quality content</p>
                            <p>User control</p>
                            <p>No ads, full privacy</p>
                        </div>
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/content">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Content</p>
                            <p>Dynamic posts</p>
                            <p>Infinite customisation</p>
                            <p>Creator help with Membership</p>
                        </div>
                    </Link>
                 </div>
                <div className="welcome-box">
                    <Link to="/algorithm">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Algorithm</p>
                            <p>Adjust your algorithm. You are in control</p>
                            <p>How you are shown content is fully customisable</p>
                            <p>Post are fact-checked, so you see what's true</p>
                        </div> 
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/feeds">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Feeds</p>
                            <p>Create and follow feeds for any topic</p>
                            <p>Divided into channels for posts and chats</p>
                            <p>Custom feeds for connections, follows, recommendations and more</p>
                        </div>
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/membership">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Membership</p>                    
                            <p>Earn money from posts</p>
                            <p>Get help from Ask</p>
                            <p>Vote for moderators, admins, leaders and features</p>
                        </div>
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/privacy">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Privacy</p>
                            <p>All data is encrypted, never leaves Aether</p>
                            <p>Your data is for you, not us</p>
                            <p>Control how your data is used to personalise content</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default WelcomeHome;
