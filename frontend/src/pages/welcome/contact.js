import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Contact = () => {
    document.title = "Contact";
    
    return (
        <div className="welcome-container">
            <p className="welcome-text">Contact</p>
            <div className="join-login">
                <Link to="/welcome">
                    <button className="button join welcome">Back</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div className="team-content">
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: 'clamp(16px, 3vw, 24px)' }}>Get in touch</p>
                    <a href="mailto:contact@aethersocial.com" style={{
                        fontSize: 'clamp(16px, 2.8vw, 22px)',
                        fontWeight: '600',
                        color: '#6a6aff',
                        textDecoration: 'none',
                        transition: 'color 0.3s ease',
                        display: 'inline-block'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#8a8aff'}
                    onMouseLeave={(e) => e.target.style.color = '#6a6aff'}>
                        contact@aethersocial.com
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Contact;