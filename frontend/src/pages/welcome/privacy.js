import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Privacy = () => {
    document.title = "Privacy Policy - Aether Social";

    return (
        <div className="welcome-container">
            <p className="welcome-text">Privacy Policy</p>
            <div className="join-login">
                <Link to="/welcome">
                    <button className="button join welcome">Back</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div className="team-content" style={{ maxWidth: '900px', margin: '0 auto', marginTop: '20px' }}>
                <div className="content-card">
                    <p style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '20px' }}>
                        Last Updated: January 25, 2026
                    </p>
                    <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', lineHeight: '1.7', marginBottom: '20px' }}>
                        Aether Social ("we," "us," or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, share, and safeguard your information when you use our platform.
                    </p>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>1. Information We Collect</p>
                    <p style={{ fontWeight: '600', fontSize: 'clamp(15px, 2.5vw, 17px)', marginTop: '20px', marginBottom: '10px' }}>
                        1.1 Information You Provide
                    </p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li><strong>Account Information:</strong> Username, email address, and password (encrypted)</li>
                        <li><strong>Profile Information:</strong> Profile picture, bio, and other optional details you choose to share</li>
                        <li><strong>Content:</strong> Posts, comments, messages, votes, and other contributions you make to the platform</li>
                        <li><strong>Connected Accounts:</strong> When you connect external accounts (Bluesky, Mastodon, Reddit), we store access tokens and handle information</li>
                    </ul>
                    <p style={{ fontWeight: '600', fontSize: 'clamp(15px, 2.5vw, 17px)', marginTop: '20px', marginBottom: '10px' }}>
                        1.2 Automatically Collected Information
                    </p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li><strong>Usage Data:</strong> Your interactions with the platform, including posts viewed, votes cast, and feeds followed</li>
                        <li><strong>Cookies:</strong> Session cookies for authentication</li>
                        <li><strong>Analytics:</strong> We use content embeddings and sentiment analysis to improve content recommendations</li>
                    </ul>
                    <p style={{ fontWeight: '600', fontSize: 'clamp(15px, 2.5vw, 17px)', marginTop: '20px', marginBottom: '10px' }}>
                        1.3 Third-Party Authentication
                    </p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li><strong>Google OAuth:</strong> When you sign in with Google, we receive your name, email, and profile picture</li>
                        <li><strong>Bluesky:</strong> When you sign in with Bluesky, we receive your DID, handle, and authentication tokens</li>
                    </ul>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>2. How We Use Your Information</p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li>To provide our services</li>
                        <li>To optionally personalise your content feed using custom algorithms</li>
                        <li>To authenticate your account and maintain security</li>
                        <li>To enable communication through direct messages and comments</li>
                        <li>To integrate with external platforms you connect (Bluesky, Mastodon, Reddit)</li>
                        <li>To detect and prevent fraud, spam, and abuse</li>
                        <li>To comply with legal obligations</li>
                    </ul>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>3. Data Sharing and Disclosure</p>
                    <p style={{ fontWeight: '600', fontSize: 'clamp(15px, 2.5vw, 17px)', marginTop: '20px', marginBottom: '10px' }}>
                        We do NOT sell your personal data. We may share information in the following circumstances:
                    </p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li><strong>Public Content:</strong> Posts, comments, and profile information you make public are visible to other users. You can make your profile and posts private at any time</li>
                        <li><strong>External Platforms:</strong> When you vote or interact with external posts (Bluesky, Mastodon, Reddit), those actions are synced to the respective platforms using your connected account credentials</li>
                        <li><strong>Service Providers:</strong> We use AWS S3 for media storage and may use other third-party services to operate our platform</li>
                        <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government request</li>
                        <li><strong>Safety and Security:</strong> To protect the rights, property, or safety of Aether Social, our users, or the public</li>
                    </ul>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>4. Data Security</p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li><strong>Encryption:</strong> Passwords are hashed using bcrypt. Private messages and sensitive data are encrypted</li>
                        <li><strong>HTTPS:</strong> All data transmission is encrypted using SSL/TLS</li>
                        <li><strong>Access Controls:</strong> We implement strict access controls to protect your data from unauthorized access</li>
                    </ul>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>5. Your Rights and Choices</p>
                    <ul style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginLeft: '20px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <li><strong>Access:</strong> You can access and review your account information and content at any time</li>
                        <li><strong>Edit:</strong> You can modify your profile information and account settings</li>
                        <li><strong>Delete:</strong> You can delete your posts, comments, and account through your settings</li>
                        <li><strong>Disconnect:</strong> You can disconnect external accounts (Bluesky, Mastodon, Reddit) at any time</li>
                        <li><strong>Opt-Out:</strong> You can control algorithm preferences and content filters in your settings</li>
                        <li><strong>Data Export:</strong> You can request a copy of your data by contacting us</li>
                    </ul>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>6. Data Retention</p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.85)' }}>
                        We retain your information for as long as your account is active or as needed to provide you services. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal compliance, dispute resolution, or enforcement of our agreements.
                    </p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginTop: '15px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        External posts fetched from connected platforms (Reddit, Bluesky, Mastodon) are subject to expiration policies and may be automatically removed after a certain period.
                    </p>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>7. Children's Privacy</p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.85)' }}>
                        Aether Social is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will delete such information.
                    </p>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>8. Third-Party Links and Services</p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.85)' }}>
                        Our platform may contain links to third-party websites and services (including Bluesky, Mastodon, and Reddit). We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies before providing them with information.
                    </p>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>9. Changes to This Privacy Policy</p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.85)' }}>
                        We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of Aether Social after such changes constitutes your acceptance of the updated policy.
                    </p>
                </div>
                <div className="content-card">
                    <p className="welcome-box-header" style={{ marginBottom: '16px' }}>10. Contact Us</p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.85)' }}>
                        If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:
                    </p>
                    <p style={{ fontSize: 'clamp(14px, 2.2vw, 16px)', lineHeight: '1.7', marginTop: '10px', color: 'rgba(255, 255, 255, 0.85)' }}>
                        <strong>Email:</strong> contact@aethersocial.com
                    </p>
                </div>
                <div className="content-card" style={{ backgroundColor: 'rgba(74, 158, 255, 0.1)', border: '1px solid rgba(74, 158, 255, 0.3)' }}>
                    <p className="welcome-box-header" style={{ marginBottom: '16px', color: '#4a9eff' }}>Your Data, Your Control</p>
                    <p style={{ fontSize: 'clamp(15px, 2.5vw, 17px)', lineHeight: '1.7', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                        At Aether Social, your privacy matters. We believe in transparency, user control, and data protection. Your personal data stays with us and is never sold to third parties.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;