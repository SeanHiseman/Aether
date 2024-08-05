import axios from 'axios';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Welcome = () => {
    const [currentView, setCurrentView] = useState('welcome');

    //Switches between settings states
    const renderComponent = () => {
        switch (currentView) {
            case 'welcome':
                return (
                    <div className="channel-content">
                        <p class="text36">Welcome to Aether</p>
                        <p class="text24">Better social media</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            case 'groups':
                return (
                    <div className="channel-content">
                        <p class="text36">Groups</p>
                        <p class="text24">Join public groups</p>
                        <p class="text24">Create groups with your friends</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            case 'profiles':
                return (
                    <div className="channel-content">
                        <p class="text36">Profiles</p>
                        <p class="text24">Different feeds for different content</p>
                        <p class="text24">Public or private</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            case 'posts':
                return (
                    <div className="channel-content">
                        <p class="text36">Posts</p>
                        <p class="text24">Images, videos and text all in one</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            case 'feeds':
                return (
                    <div className="channel-content">
                        <p class="text36">Feeds</p>
                        <p class="text24">View posts from friends, following and recommendations</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            case 'algorithm':
                return (
                    <div className="channel-content">
                        <p class="text36">Algorithm</p>
                        <p class="text24">Focused on quality, not quantity</p>
                        <p class="text24">You are in control</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            case 'membership':
                return (
                    <div className="channel-content">
                        <p class="text36">Membership benefits</p>
                        <p class="text24">Earn money from posts</p>
                        <p class="text24">Copilot</p>
                        <p class="text24">Adjustable feeds</p>
                        <p class="text24">Custom appearance</p>
                        <p class="text24">Longer posts</p>
                        <p class="text24">Voting</p>
                        <button className="button join">Buy membership</button>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="channel-content">
                        <p class="text36">Privacy</p>
                        <p class="text24">Totally encrypted</p>
                        <p class="text24">Your data is for you, not us</p>
                        <button className="button join">Join for free</button>
                    </div>
                );
            default:
                return (
                    <p class="text36">Error, sorry!</p>
                );
        }
    };

    document.title="welcome";
    return (
        <div className="container">
            <aside id="left-aside">
                <div id="welcome-items">
                    <nav>
                        <ul>
                            <li className="settings-item" onClick={() => setCurrentView('membership')}>Membership</li>
                            <li className="settings-item" onClick={() => setCurrentView('groups')}>Groups</li>
                            <li className="settings-item" onClick={() => setCurrentView('profiles')}>Profiles</li>
                            <li className="settings-item" onClick={() => setCurrentView('posts')}>Posts</li>
                            <li className="settings-item" onClick={() => setCurrentView('feeds')}>Feeds</li>
                            <li className="settings-item" onClick={() => setCurrentView('algorithm')}>Algorithm</li>
                            <li className="settings-item" onClick={() => setCurrentView('privacy')}>Privacy</li>
                        </ul>
                    </nav>
                </div>
            </aside>
            <main>
                <header id="base-header">
                    <p class="text36" onClick={() => setCurrentView('welcome')}>Welcome</p>
                </header>
                <div className="content">
                    <div className="home-container">
                        <div className="content-feed">
                            {renderComponent()} 
                        </div>
                        <div id="right-aside">
                            <Link to={'/login'}>
                                <button className="button join">Login</button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Welcome;
