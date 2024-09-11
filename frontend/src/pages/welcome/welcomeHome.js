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
                            <p>Content focused on quality</p>
                            <p>No ads, full privacy</p>
                            <p>Feeds, public and private</p>
                        </div>
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/content">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Content</p>
                            <p>Images, videos, text and more all in one</p>
                            <p>Posts can be made in reply to other posts</p>
                            <p>Members can write longer posts and view higher quality videos</p>
                        </div>
                    </Link>
                 </div>
                <div className="welcome-box">
                    <Link to="/algorithm">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Algorithm</p>
                            <p>Your algorithm can be adjusted. You are in control</p>
                            <p>Multiple votes on content, so users can better expresss their view</p>
                            <p>Posts containing misinformation are weighted lower, so you only see what's true</p>
                        </div> 
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/feeds">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Feeds</p>
                            <p>Home for posts and chats. Each feed contains channels</p>
                            <p>Feeds can be for groups or individuals, and be public or private</p>
                            <p>You can view posts from friends, feeds you follow, and recommendations</p>
                        </div>
                    </Link>
                </div>
                <div className="welcome-box">
                    <Link to="/membership">
                        <div className="left-aligned-text">
                            <p className="welcome-box-header">Membership</p>                    
                            <p>Earn money from posts.</p>
                            <p>Need to check the accuracy of a post? Just Ask</p>
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
