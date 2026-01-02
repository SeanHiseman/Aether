import { useState } from 'react';

const Help = () => {
    const [activeSection, setActiveSection] = useState('');

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(id);
        }
    };

    const sections = [
        { id: 'posts', title: 'Posts', content: 'Posts are made to a channel in a feed. Posts can contain text, images, videos, and custom content, all mixed together. At the bottom of every post is a link to the channel and feed where the post was made.' },
        { id: 'user-feeds', title: 'User feeds', content: 'Each user has their own feed where only they can post. This feed can be public or private. Private feeds require permission to be followed.' },
        { id: 'group-feeds', title: 'Group feeds', content: 'Group feeds work the same as user feeds, except that multiple users can post together. Anyone can create a group feed.' },
        { id: 'combined-feeds', title: 'Combined feeds', content: 'Feeds that you follow can be dragged and dropped together to form a combined feed, visible only to you. These collate all posts from the contained feeds.' },
        { id: 'channels', title: 'Channels', content: 'Feeds are divided into channels for different topics. The main channel combines every post the user has made in all channels and group feeds.' },
        { id: 'custom-algorithms', title: 'Custom Algorithms', content: 'Wherever you see posts, you can apply custom algorithms. Use the Choose Algorithm button on the right aside. You can choose from predefined template algorithms, describe your custom algorithm, or manually choose the algorithm settings.' },
        { id: 'connected-accounts', title: 'Notifications', content: 'You can connect your accounts from Reddit, Bluesky, and Mastodon. In the following feed, you will see posts from your connected platforms.' },
        { id: 'privacy', title: 'Privacy', content: 'Your personal information does not leave our platform. All your account data is permanently removed immediately upon account deletion.' },
    ];

    const faqs = [
        { id: 'faq-1', question: 'Can I send messages?', answer: 'Messages will be added soon. You will be able to share posts with your connections.' },
        { id: 'faq-2', question: 'Will I get any notifications?', answer: 'Notifications will be added soon, along with options to turn them off.' },
        { id: 'faq-3', question: 'Why does my custom algorithm not work?', answer: 'We have a limited number of posts and customisation options for now, so not every custom algorithm can be satisfied.' },
        { id: 'faq-4', question: 'Why do some features not work on mobile?', answer: 'Let us know using the feedback form if you find any mobile issues.' },
        { id: 'faq-5', question: 'How do I report a bug?', answer: 'Use the feedback form below your profile picture on the left aside. We really appreciate you helping us to improve!' },
        { id: 'faq-6', question: 'How do I contact support?', answer: 'support@aethersocial.com' },
        { id: 'faq-7', question: 'Are other languages supported?', answer: 'Not yet, but they will be added.' },
        { id: 'faq-8', question: 'How do you make money', answer: 'We will have a paid monthly subscription for premium features. This is being given away for free to our first 1000 users.' },
    ];

    const containerStyle = {
        display: 'flex',
        width: '100%',
        maxWidth: '100vw',
        gap: 'var(--large-margin)'
    };

    const mainContentStyle = {
        flex: '1',
        minWidth: '0',
        padding: 'var(--large-margin)',
        maxWidth: 'calc(100% - var(--right-width) - var(--large-margin))',
        marginTop: 'var(--header-height)'
    };

    const sectionStyle = {
        marginBottom: 'var(--xl-margin)'
    };

    const headingStyle = {
        marginBottom: 'var(--medium-margin)'
    };

    const asideStyle = {
        width: 'var(--right-width)',
        backgroundColor: 'var(--dark)',
        padding: 'var(--medium-margin)',
        position: 'fixed',
        right: '0',
        top: '0',
        height: '100vh',
        overflowY: 'auto',
        borderLeft: '1px solid var(--border)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
    };

    const asideHeadingStyle = {
        marginBottom: 'var(--medium-margin)',
        color: 'var(--lightest)'
    };

    const navItemStyle = (isActive) => ({
        padding: 'var(--small-margin)',
        cursor: 'pointer',
        color: isActive ? 'var(--lightest)' : 'var(--light)',
        backgroundColor: isActive ? 'var(--darkest)' : 'transparent',
        borderRadius: 'var(--small-margin)'
    });

    return (
        <div style={containerStyle}>
            <div style={mainContentStyle}>
                <div className="large-text" style={{ marginBottom: 'var(--xl-margin)' }}>Help</div>
                {sections.map((section) => (
                    <div key={section.id} id={section.id} style={sectionStyle}>
                        <div className="medium-text underline" style={headingStyle}>{section.title}</div>
                        <div className="small-text">{section.content}</div>
                    </div>
                ))}
                <div className="large-text" style={{ 
                    marginTop: 'calc(2 * var(--xl-margin))',
                    marginBottom: 'var(--xl-margin)' 
                }}>Frequently Asked Questions</div>
                {faqs.map((faq) => (
                    <div key={faq.id} id={faq.id} style={sectionStyle}>
                        <div className="medium-text underline" style={headingStyle}>{faq.question}</div>
                        <div className="small-text">{faq.answer}</div>
                    </div>
                ))}
            </div>
            <aside style={asideStyle}>
                <style>{`
                    aside::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                <div className="small-text bold" style={asideHeadingStyle}>Help</div>
                {sections.map((section) => (
                    <div
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className="tiny-text"
                        style={navItemStyle(activeSection === section.id)}
                        onMouseEnter={(e) => {
                            if (activeSection !== section.id) {
                                e.currentTarget.style.backgroundColor = 'var(--darkest)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== section.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        {section.title}
                    </div>
                ))}
                <div className="small-text bold" style={asideHeadingStyle}>FAQs</div>
                {faqs.map((faq) => (
                    <div
                        key={faq.id}
                        onClick={() => scrollToSection(faq.id)}
                        className="tiny-text"
                        style={navItemStyle(activeSection === faq.id)}
                        onMouseEnter={(e) => {
                            if (activeSection !== faq.id) {
                                e.currentTarget.style.backgroundColor = 'var(--darkest)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== faq.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        {faq.question}
                    </div>
                ))}
            </aside>
        </div>
    );
};

export default Help;