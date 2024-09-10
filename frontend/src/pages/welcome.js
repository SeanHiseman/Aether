import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../css/welcome.css';

const Welcome = () => {

    document.title="Welcome";
    return (
        <div id="welcome-container">
            <p id="welcome-text">Welcome to Aether</p>
            <p className="text24">Better social media</p>
            <div id="join-login">
                <Link to="/login">
                    <button className="button join">Login</button>
                </Link>
                <Link to="/join">
                    <button className="button join">Join</button>
                </Link>
            </div>
            <div id="welcome-center">
                <div className="welcome-box">
                    <div className="left-aligned-text">
                        <p>-No ads, full privacy</p>
                        <p>-Content focused on quality</p>
                        <p>-Groups, large and small. Public or private</p>
                        <p>-Premium features with membership. Get paid for posts</p>
                        <div className="spacer20px"/>
                        <p>This is a prototype. Outlined here is a vision. Help make it a reality</p>
                    </div>
                </div>
                <div className="welcome-box">
                    <div className="left-aligned-text">
                        <p className="text36">Feeds</p>
                        <div className="spacer20px"/>
                        <p>-Aether is built around feeds for posts and chats. Each feed contains channels</p>
                        <p>-Feeds can be for groups or individuals, and be public or private</p>
                        <div className="spacer20px"/>
                        <p className="text36">Personal feeds</p>
                        <div className="spacer20px"/>
                        <p>-These are feeds only visible to you. They contain specific types of posts</p>
                        <p>-You can view posts from friends, feeds you follow, and recommendations</p>
                        <p>-Members can create custom feeds</p>
                    </div>
                </div>
                <div className="welcome-box">
                    <div className="left-aligned-text">
                        <p className="text36">Posts</p>
                        <div className="spacer20px"/>
                        <p>-Images, videos, text and more all in one</p>
                        <p>-Posts can be made in reply to other posts</p>
                        <p>-Members can write longer posts</p>
                    </div>
                </div>
                <div className="welcome-box">
                    <div className="left-aligned-text">
                        <p className="text36">Algorithm</p>
                        <div className="spacer20px"/>
                        <p>-Focused on quality, not quantity</p>
                        <p>-Posts with higher upvotes and lower downvotes per view are boosted</p>
                        <p>-Multiple votes on content, so users can better expresss their view</p>
                        <p>-Posts containing misinformation are weighted lower, so you only see what's true</p>
                        <p>-Your algorithm can be adjusted. You are in control</p>
                    </div> 
                </div>
                <div className="welcome-box">
                    <div className="left-aligned-text">
                        <p className="text36">Membership</p>
                        <div className="spacer20px"/>
                        <p>-Ask is an assistant that aids throughout Aether</p>
                        <p>-Need to check the accuracy of a post, find the perfect content or get help using the site? Just Ask</p>
                        <div className="spacer20px"/>
                        <p className="text36">Benefits</p>
                        <p>-Earn money from posts. The more upvotes and fewer downvotes, the more you make per view</p>
                        <p>-Custom personal feeds. Full control over how you sort your content</p>
                        <p>-Dive in to detail by writing longer posts. Up to 100,000 characters</p>
                        <p>-Voting for moderators, admins, leaders and features</p>
                    </div>
                </div>
                <div className="welcome-box">
                    <div className="left-aligned-text">
                        <p className="text36">Privacy</p>
                        <div className="spacer20px"/>
                        <p>-All data is encrypted, never leaves Aether</p>
                        <p>-Your data is for you, not us</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
