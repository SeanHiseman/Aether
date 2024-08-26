import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../css/welcome.css';
import { ThemeContext } from '../themeProvider';

const Welcome = () => {
    const [currentView, setCurrentView] = useState('welcome');
    const { setTheme } = useContext(ThemeContext);

    //Switches between settings states
    const renderComponent = () => {
        switch (currentView) {
            case 'welcome':
                return (
                    <div className="channel-content">
                        <div className="left-aligned-text">
                            <p class="text36">Welcome to Aether</p>
                            <p class="text24">Better social media</p>
                            <div className="spacer20px"/>
                            <p class="text24">-No ads, full privacy</p>
                            <p class="text24">-Content focused on quality</p>
                            <p class="text24">-Groups, large and small. Public or private</p>
                            <p class="text24">-Premium features with membership. Get paid for posts</p>
                            <div className="spacer20px"/>
                            <p class="text24">This is a prototype. Outlined here is a vision. Help make it a reality</p>
                        </div>
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
            case 'feeds':
                return (
                    <div className="channel-content">
                        <div className="left-aligned-text">
                            <p class="text36">Feeds</p>
                            <div className="spacer20px"/>
                            <p class="text24">-Aether is built around feeds for posts and chats. Each feed contains channels</p>
                            <p class="text24">-Feeds can be for groups or individuals, and be public or private</p>
                            <div className="spacer20px"/>
                            <p class="text36">Personal feeds</p>
                            <div className="spacer20px"/>
                            <p class="text24">-These are feeds only visible to you. They contain specific types of posts</p>
                            <p class="text24">-You can view posts from friends, feeds you follow, and recommendations</p>
                            <p class="text24">-Members can create custom feeds</p>
                        </div>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'posts':
                return (
                    <div className="channel-content">
                        <div className="left-aligned-text">
                            <p class="text36">Posts</p>
                            <div className="spacer20px"/>
                            <p class="text24">-Images, videos, text and more all in one</p>
                            <p class="text24">-Posts can be made in reply to other posts</p>
                            <p class="text24">-Members can write longer posts</p>
                        </div>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'algorithm':
                return (
                    <div className="channel-content">
                        <div className="left-aligned-text">
                            <p class="text36">Algorithm</p>
                            <div className="spacer20px"/>
                            <p class="text24">-Focused on quality, not quantity</p>
                            <p class="text24">-Posts with higher upvotes and lower downvotes per view are boosted</p>
                            <p class="text24">-Multiple votes on content, so users can better expresss their view</p>
                            <p class="text24">-Posts containing misinformation are weighted lower, so you only see what's true</p>
                            <p class="text24">-Your algorithm can be adjusted. You are in control</p>
                        </div>
                        <Link to="/join">
                            <button className="light-button join">Join</button>
                        </Link>
                    </div>
                );
            case 'membership':
                return (
                    <div className="channel-content">
                        <div className="left-aligned-text">
                            <p class="text36">Membership</p>
                            <div className="spacer20px"/>
                            <p class="text36">Ask</p>
                            <p class="text24">-Ask is an assistant that aids throughout Aether</p>
                            <p class="text24">-Need to check the accuracy of a post, find the perfect content or get help using the site? Just Ask</p>
                            <div className="spacer20px"/>
                            <p class="text36">Benefits</p>
                            <p class="text24">-Earn money from posts. The more upvotes and fewer downvotes, the more you make per view</p>
                            <p class="text24">-Custom personal feeds. Full control over how you sort your content</p>
                            <p class="text24">-Dive in to detail by writing longer posts. Up to 100,000 characters</p>
                            <p class="text24">-Voting for moderators, admins, leaders and features</p>
                            <p class="text24"></p>
                        </div>
                        <button className="light-button join">Buy membership</button>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="channel-content">
                        <div className="left-aligned-text">
                            <p class="text36">Privacy</p>
                            <div className="spacer20px"/>
                            <p class="text24">-All data is encrypted, never leaves Aether</p>
                            <p class="text24">-Your data is for you, not us</p>
                        </div>
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

    document.title="Welcome";
    return (
        <div className="container">
            <aside id="left-aside">
                <p id="aside-welcome-text" onClick={() => setCurrentView('welcome')}>Aether</p>
                <div id="welcome-items">
                    <nav>
                        <ul>
                            <li className="settings-item" onClick={() => setCurrentView('membership')}>Membership</li>
                            <li className="settings-item" onClick={() => setCurrentView('feeds')}>Feeds</li>
                            <li className="settings-item" onClick={() => setCurrentView('posts')}>Posts</li>
                            <li className="settings-item" onClick={() => setCurrentView('algorithm')}>Algorithm</li>
                            <li className="settings-item" onClick={() => setCurrentView('privacy')}>Privacy</li>
                        </ul>
                    </nav>
                </div>
            </aside>
            <main>
                <header id="base-header">
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
