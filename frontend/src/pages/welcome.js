import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/welcome.css';

const Welcome = () => {
    const [currentQuery, setCurrentQuery] = useState('');
    const [currentView, setCurrentView] = useState('welcome');
    const navigate = useNavigate();

    //Sends to ask page
    const handleAskClick = (event) => {
        event.preventDefault();
        navigate('/ask', { state: { query: currentQuery } });
    };
    //Sends to search page
    const handleSearchClick = (event) => {
        event.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };
    
    //Switches between settings states
    const renderComponent = () => {
        switch (currentView) {
            case 'welcome':
                return (
                    <div className="channel-content">
                        <p class="text36">Welcome to Aether</p>
                        <p class="text24">Better social media</p>
                        <div id="join-login">
                            <Link to="/join">
                                <button className="light-button join">Join</button>
                            </Link>
                            <Link to="/login">
                                <button className="light-button join">Login</button>
                            </Link>
                        </div>
                    </div>
                );
            case 'groups':
                return (
                    <div className="channel-content">
                        <p class="text36">Groups</p>
                        <p class="text24">Join public groups</p>
                        <p class="text24">Create groups with your friends</p>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'profiles':
                return (
                    <div className="channel-content">
                        <p class="text36">Profiles</p>
                        <p class="text24">Different feeds for different content</p>
                        <p class="text24">Public or private</p>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'posts':
                return (
                    <div className="channel-content">
                        <p class="text36">Posts</p>
                        <p class="text24">Images, videos and text all in one</p>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'feeds':
                return (
                    <div className="channel-content">
                        <p class="text36">Feeds</p>
                        <p class="text24">View posts from friends, following and recommendations</p>
                        <p class="text24">Create custom feeds</p>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'algorithm':
                return (
                    <div className="channel-content">
                        <p class="text36">Algorithm</p>
                        <p class="text24">Focused on quality, not quantity</p>
                        <p class="text24">Multiple votes on content</p>
                        <p class="text24">Misinformation is controlled</p>
                        <p class="text24">You are in control</p>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
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
                        <button className="light-button join">Buy membership</button>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="channel-content">
                        <p class="text36">Privacy</p>
                        <p class="text24">All data is encrypted, never leaves Aether</p>
                        <p class="text24">Your data is for you, not us</p>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
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
                <p id="aside-welcome-text" onClick={() => setCurrentView('welcome')}>Aether</p>
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
                    <div className="spacer"></div>
                        <form id="search-form" onSubmit={(e) => {
                            e.preventDefault();
                            handleSearchClick();
                        }}>
                            <div className="search-container">
                                <button className="icon-button ask" data-tooltip="Ask" type="button" onClick={handleAskClick}>
                                    <img className="standard-icon" src="/media/site_images/icons/ask.png" alt="Ask"/>
                                </button>
                                <input id="search-bar" type="text" name="keyword" placeholder="Type..." value={currentQuery} onChange={(e) => setCurrentQuery(e.target.value)}/>
                                <button className="icon-button search" data-tooltip="Search" type="submit" onClick={handleSearchClick}>
                                    <img className="standard-icon" src="/media/site_images/icons/search.png" alt="Search"/>
                                </button>
                            </div>
                        </form>
                <div className="spacer"></div>
                <button id="messages-button">Messages</button>
                </header>
                <div className="content">
                    <div className="home-container">
                        <div className="content-feed">
                            {renderComponent()} 
                        </div>
                        <div id="right-aside" class="light">
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Welcome;
