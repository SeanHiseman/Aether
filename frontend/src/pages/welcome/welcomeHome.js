import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../css/welcome.css';
import AlgorithmSelector from '../../algorithms/algorithmSelector';
import ContentWidget from '../../components/content/contentWidget';
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
                <Link to="/explore">
                    <p className="welcome-text">Welcome to Aether Social</p>
                </Link>
                <p className="medium-text">Free premium for first 1000 users, join soon!</p>
                <div className="join-login">
                    <Link to="/login">
                        <button className="button join welcome">Login</button>
                    </Link>
                    <Link to="/join">
                        <button className="button join welcome">Join</button>
                    </Link>
                </div>
                <p className="medium-text" style={{ marginTop: '20px' }}>Customise the algorithms that shows you content:</p>
                <AlgorithmSelector display={true} locationId={'display'} />
                <p className="medium-text" style={{ marginTop: '20px' }}>Share interactive posts:</p>
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
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3 style={{ marginLeft: 0 }}>Business</h3>
                        <div className="footer-links">
                            <Link to="/welcome/team">Team</Link>
                            <Link to="/welcome/support">Support</Link>
                            <Link to="/welcome/security">Security</Link>
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
                            <a href="https://www.linkedin.com/company/107417499/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="LinkedIn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                            </a>
                            <a href="https://www.reddit.com/user/aether-social/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Reddit">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                                </svg>
                            </a>
                            <a href="https://x.com/AetherSocialApp" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="X (Twitter)">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <   path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                                </svg>
                            </a>
                            <a href="https://mastodon.social/@aethersocial" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Mastodon">
                                <svg width="20" height="20" viewBox="0 0 216.4144 232.00976" fill="currentColor">
                                    <path d="M211.80734 139.0875c-3.18125 16.36625-28.4925 34.2775-57.5625 37.74875-15.15875 1.80875-30.08375 3.47125-45.99875 2.74125-26.0275-1.192125-46.565-6.2125-46.565-6.2125 0 2.53375.15625 4.94625.46875 7.2025 3.38375 25.68625 25.47 27.225 46.39125 27.9425 21.11625.7225 39.91875-5.20625 39.91875-5.20625l.8675 19.09s-14.77 7.93125-41.08125 9.39c-14.50875.7975-32.52375-.365-53.50625-5.91875C9.23234 213.82 1.40609 165.31125.20859 116.09125c-.365-14.61375-.14-28.39375-.14-39.91875 0-50.33 32.97625-65.0825 32.97625-65.0825C49.67234 3.45375 78.20359.2425 107.86484 0h.72875c29.66125.2425 58.21125 3.45375 74.8375 11.09 0 0 32.975 14.7525 32.975 65.0825 0 0 .41375 37.13375-4.59875 62.915"/>
                                    <path d="M177.50984 80.077v60.94125h-24.14375v-59.15c0-12.46875-5.24625-18.7975-15.74-18.7975-11.6025 0-17.4175 7.5075-17.4175 22.3525v32.37625H96.20734V85.42325c0-14.845-5.81625-22.3525-17.41875-22.3525-10.49375 0-15.74 6.32875-15.74 18.7975v59.15H38.90484V80.077c0-12.455 3.17125-22.3525 9.54125-29.675 6.56875-7.3225 15.17125-11.07625 25.85-11.07625 12.355 0 21.71125 4.74875 27.8975 14.2475l6.01375 10.08125 6.015-10.08125c6.185-9.49875 15.54125-14.2475 27.8975-14.2475 10.6775 0 19.28 3.75375 25.85 11.07625 6.36875 7.3225 9.54 17.22 9.54 29.675"/>
                                </svg>
                            </a>
                            <a href="https://bsky.app/profile/aethersocial.bsky.social" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Bluesky">
                                <svg width="20" height="20" viewBox="0 0 568 501" fill="currentColor">
                                    <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.89-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664z"/>
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