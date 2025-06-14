import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const WelcomeHome = () => {
    document.title = "Welcome to Aether Social";
    
    return (
        <>
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
                    <Link to="/welcome/about">
                        <div className="welcome-box">
                            <div className="left-aligned-text">
                                <p className="welcome-box-header">About Aether</p>
                                <p>The world's only platform for sharing dynamic content</p>
                                <p>Control your content with custom algorithms and deep feeds</p>
                                <p>Built for usefulness, not attention</p>
                            </div>
                        </div>
                    </Link>
                    <Link to="/welcome/content">
                        <div className="welcome-box">
                            <div className="left-aligned-text">
                                <p className="welcome-box-header">Content</p>
                                <p>Dynamic, interactive posts</p>
                                <p>Infinitely customizable experiences</p>
                                <p>Generate or build content yourself</p>
                            </div>
                        </div>
                    </Link>
                    <Link to="/welcome/feeds">
                        <div className="welcome-box">
                            <div className="left-aligned-text">
                                <p className="welcome-box-header">Feeds</p>
                                <p>Create and follow feeds for any topic</p>
                                <p>Organized into channels for posts and chats</p>
                                <p>Deep feeds mix and sort content intelligently</p>
                            </div>
                        </div>
                    </Link>
                    <Link to="/welcome/algorithm">
                        <div className="welcome-box">
                            <div className="left-aligned-text">
                                <p className="welcome-box-header">Algorithm</p>
                                <p>Adjust your algorithm - you are in control</p>
                                <p>Content delivery is fully customizable</p>
                                <p>Save and reuse algorithms across feeds</p>
                            </div>
                        </div>
                    </Link>
                    <Link to="/welcome/membership">
                        <div className="welcome-box">
                            <div className="left-aligned-text">
                                <p className="welcome-box-header">Membership</p>
                                <p>Create longer, more detailed posts</p>
                                <p>Access to highest quality AI models</p>
                                <p>Enhanced limits and premium features</p>
                            </div>
                        </div>
                    </Link>
                    <Link to="/welcome/privacy">
                        <div className="welcome-box">
                            <div className="left-aligned-text">
                                <p className="welcome-box-header">Privacy</p>
                                <p>Personal data encrypted, never leaves Aether</p>
                                <p>Your data belongs to you, not us</p>
                                <p>Control how data personalizes your content</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Business</h3>
                        <div className="footer-links">
                            <Link to="/welcome/team">Team</Link>
                            <Link to="/welcome/support">Support</Link>
                        </div>
                    </div>
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Legal</h3>
                        <div className="footer-links">
                            <Link to="/welcome/terms">Terms of Service</Link>
                            <Link to="/welcome/licenses">Licenses</Link>
                            <Link to="/welcome/private-policy">Privacy Policy</Link>
                        </div>
                    </div>
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Connect</h3>
                        <div className="footer-links">
                            <Link to="/welcome/contact">Contact</Link>
                        </div>
                        <div className="social-links">
                            <a href="https://www.linkedin.com/company/107417499/" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="social-link"
                               aria-label="LinkedIn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                            </a>
                            <a href="https://www.reddit.com/user/aether-social/" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="social-link"
                               aria-label="Reddit">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                                </svg>
                            </a>
                            <a href="https://x.com/AetherSocialApp" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="social-link"
                               aria-label="X (Twitter)">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2025 Aether Social Limited. All rights reserved.</p>
                </div>
            </footer>
        </>
    );
};

export default WelcomeHome;