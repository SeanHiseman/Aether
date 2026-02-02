import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../css/welcome.css';
import AlgorithmSelector from '../../algorithms/algorithmSelector';
import ContentWidget from '../../components/content/contentWidget';
import { FaArrowRight, FaComments, FaLayerGroup, FaPalette, FaQuoteRight, FaReply, FaRetweet, FaUserFriends } from 'react-icons/fa';
import { SiBluesky, SiMastodon, SiReddit } from 'react-icons/si';
import { loadWelcomeContent } from './welcomeContent';

const WelcomeHome = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [welcomePosts, setWelcomePosts] = useState([]);
    
	useEffect(() => {
		document.title = "Welcome to Aether Social";
		loadWelcomeContent().then(setWelcomePosts);
	}, []);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % welcomePosts.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + welcomePosts.length) % welcomePosts.length);
    };
    
    return (
        <>
            <div className="welcome-container">
                <Link to="/explore" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <p className="welcome-text">Welcome to Aether Social</p>
                    <p className="small-text faded-text" style={{
                        fontWeight: '500',
                        marginBottom: '20px',
                        textAlign: 'center',
                        fontSize: 'clamp(16px, 3vw, 24px)',
                        letterSpacing: '0.3px'
                    }}>Social media you control</p>
                </Link>
                {/*<p className="medium-text">Free premium for first 1000 users, join soon!</p>*/}
                <div className="join-login">
                    <Link to="/login">
                        <button className="button join welcome">Login</button>
                    </Link>
                    <Link to="/join">
                        <button className="button join welcome">Join</button>
                    </Link>
                </div>
                <div style={{
                    maxWidth: 'clamp(600px, 80vw, 1200px)',
                    width: '100%',
                    marginTop: 'clamp(20px, 4vw, 32px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <p className="medium-text" style={{
                        marginBottom: 'clamp(12px, 2.5vw, 20px)',
                        fontSize: 'clamp(18px, 3.5vw, 28px)',
                        fontWeight: '600',
                        textAlign: 'center',
                        letterSpacing: '-0.01em'
                    }}>Customise the algorithms that shows you content</p>
                    <AlgorithmSelector display={true} locationId={'display'} />
                </div>
                <div style={{
                    maxWidth: 'clamp(600px, 90vw, 1200px)',
                    width: '100%',
                    marginTop: 'clamp(32px, 5vw, 48px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 'clamp(16px, 3vw, 24px)',
                        width: '100%'
                    }} className="features-grid">
                        {/* Combined Feeds */}
                        <div className="feature-box">
                            <div className="feature-icon">
                                <FaLayerGroup size={32} />
                            </div>
                            <h3 className="feature-title">Combined Feeds</h3>
                            <p className="feature-description">
                                Organise who you follow into different combined feeds
                            </p>
                        </div>
                        {/* Post and Chat Channels */}
                        <div className="feature-box">
                            <div className="feature-icon">
                                <FaComments size={32} />
                            </div>
                            <h3 className="feature-title">Post & Chat Channels</h3>
                            <p className="feature-description">
                                Split feeds into channels for chatting and posting. Like combining Subreddits and Discord servers
                            </p>
                        </div>
                        {/* Multiple Chats */}
                        <div className="feature-box">
                            <div className="feature-icon">
                                <FaUserFriends size={32} />
                            </div>
                            <h3 className="feature-title">Multiple Chats</h3>
                            <p className="feature-description">
                                Have multiple different chats with the same friend.
                            </p>
                        </div>
                        {/* Platform Connections */}
                        <div className="feature-box">
                            <div className="feature-icon" style={{ display: 'flex', gap: '8px' }}>
                                <SiBluesky size={26} />
                                <SiMastodon size={26} />
                                <SiReddit size={26} />
                            </div>
                            <h3 className="feature-title">Connect Accounts</h3>
                            <p className="feature-description">
                                Integrate your Bluesky, Mastodon, and Reddit accounts to view and interact with posts from other platforms
                            </p>
                        </div>
                        {/* Repost, Quote, Reply */}
                        <div className="feature-box">
                            <div className="feature-icon" style={{ display: 'flex', gap: '8px' }}>
                                <FaRetweet size={26} />
                                <FaQuoteRight size={26} />
                                <FaReply size={26} />
                            </div>
                            <h3 className="feature-title">Quote, reply, or repost</h3>
                            <p className="feature-description">
                                Share your thoughts about posts from different platforms
                            </p>
                        </div>
                        {/* Custom Color Schemes */}
                        <div className="feature-box">
                            <div className="feature-icon">
                                <FaPalette size={32} />
                            </div>
                            <h3 className="feature-title">Custom Themes</h3>
                            <p className="feature-description">
                                Finely adjust your colour scheme
                            </p>
                        </div>
                    </div>
                </div>
                <div style={{
                    maxWidth: 'clamp(600px, 80vw, 1200px)',
                    width: '100%',
                    marginTop: 'clamp(20px, 4vw, 32px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <p className="medium-text" style={{
                        marginBottom: 'clamp(12px, 2.5vw, 20px)',
                        fontSize: 'clamp(18px, 3.5vw, 28px)',
                        fontWeight: '600',
                        textAlign: 'center',
                        letterSpacing: '-0.01em'
                    }}>Share interactive posts</p>
                    <div className="welcome-posts-slideshow">
                        {welcomePosts.length > 1 && (
                            <div className="slideshow-controls">
                                <button className="slideshow-btn prev" onClick={prevSlide}>
                                    ‹
                                </button>
                                <button className="slideshow-btn next" onClick={nextSlide}>
                                    ›
                                </button>
                            </div>
                        )}
                        <div className="slideshow-container">
                            {welcomePosts.map((post, index) => (
                                <div key={post?.post_id} className={`slide ${index === currentSlide ? 'active' : ''}`}>
                                    <ContentWidget display={true} post={post} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <Link to="/explore">
                    <button className="large-icon" style={{ margin: 'clamp(24px, 5vw, 40px) 0', transition: 'all 0.3s ease' }}>
                        <FaArrowRight/>
                        <p className="icon-text">Explore posts</p>
                    </button>
                </Link>
            </div>
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Business</h3>
                        <div className="footer-links">
                            <Link to="/team">Team</Link>
                            <Link to="/support">Support</Link>
                            <Link to="/security">Security</Link>
                        </div>
                    </div>
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Legal</h3>
                        <div className="footer-links">
                            <Link to="/terms">Terms of Service</Link>
                            <Link to="/licenses">Licenses</Link>
                            <Link to="/privacy">Privacy Policy</Link>
                        </div>
                    </div>
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Connect</h3>
                        <div className="footer-links">
                            <Link to="/welcome/contact">Contact</Link>
                        </div>
                        <div className="social-links">
                            <a href="https://www.linkedin.com/company/107417499/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="LinkedIn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                            </a>
                            <a href="https://www.reddit.com/user/aether-social/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Reddit">
                                <SiReddit />
                            </a>
                            <a href="https://x.com/AetherSocialApp" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="X (Twitter)">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <   path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                                </svg>
                            </a>
                            <a href="https://mastodon.social/@aethersocial" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Mastodon">
                                <SiMastodon />
                            </a>
                            <a href="https://bsky.app/profile/aethersocial.bsky.social" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Bluesky">
                                <SiBluesky />
                            </a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2026 Aether Social Limited. All rights reserved.</p>
                </div>
            </footer>
        </>
    );
};

export default WelcomeHome;