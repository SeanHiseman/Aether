import SwipeableAside from '../../components/swipeableAside';
import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';

const Help = () => {
	const [activeSection, setActiveSection] = useState('');
	const { rightClasses, closeDrawers, mobileOpen } = useOutletContext();

	const isMobile = () => window.matchMedia("(max-width:768px)").matches;
	const computedRightClasses = [
		rightClasses
	].filter(Boolean).join(" ");

	const scrollToSection = (id) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			setActiveSection(id);
		}
	};

	const sections = [
		{ id: 'custom-algorithms', title: 'Custom Algorithms', content: 'Wherever you see posts, you can apply custom algorithms. Use the Choose Algorithm button on the right aside. You can choose from predefined template algorithms, describe your custom algorithm, or manually choose the algorithm settings.' },
		{ id: 'user-feeds', title: 'User feeds', content: 'Each user has their own feed where only they can post. This feed can be public or private. Private feeds require permission to be followed.' },
		{ id: 'group-feeds', title: 'Group feeds', content: 'Group feeds work the same as user feeds, except that multiple users can post together. Anyone can create a group feed.' },
		{ id: 'combined-feeds', title: 'Combined feeds', content: 'Feeds that you follow can be dragged and dropped together to form a combined feed, visible only to you. These collate all posts from the contained feeds.' },
		{ id: 'channels', title: 'Channels', content: 'Feeds are divided into channels for different topics. The main channel combines every post the user has made in all channels and group feeds.' },
		{ id: 'posts', title: 'Posts', content: 'Posts are made to a channel in a feed. Posts can contain text, images, videos, and custom content, all mixed together. At the bottom of every post is a link to the channel and feed where the post was made.' },
		{ id: 'custom-posts', title: 'Custom posts', content: 'Posts can contain custom code, enabling them to act like an app or webpage. These posts can be generated in the content form.' },
		{ id: 'connected-accounts', title: 'Connected accounts', content: 'You can connect your accounts from Reddit, Bluesky, and Mastodon. In the following feed, you will see posts from your connected platforms.' },
		{ id: 'privacy', title: 'Privacy', content: 'Your personal information does not leave our platform. All your account data is permanently removed immediately upon account deletion.' },
	];

	const faqs = [
		{ id: 'faq-1', question: 'How do I change the colour scheme?', answer: 'Click the cog next to your name at the top of the left aside. On the right aside will be a colour theme section.' },
		{ id: 'faq-2', question: 'How do I create interactive posts?', answer: 'Select the custom block in the post form and prompt your post. Alternatively, you could generate the code for the post elsewhere and paste it into the direct input box.' },
		{ id: 'faq-3', question: 'Why does my custom algorithm not work?', answer: 'We have a limited number of posts and customisation options for now, so not every custom algorithm can be satisfied. Still, send us some feedback!' },
		{ id: 'faq-4', question: 'Why do some features not work on mobile?', answer: 'Let us know using the feedback form if you find any mobile issues.' },
		{ id: 'faq-5', question: 'Do you have a mobile app?', answer: 'iOS and Android apps coming soon...' },
		{ id: 'faq-6', question: 'How do I report a bug?', answer: 'Use the feedback form below your profile picture on the left aside. We really appreciate you helping us to improve!' },
		{ id: 'faq-7', question: 'How do I contact support?', answer: 'support@aethersocial.com' },
		{ id: 'faq-8', question: 'Are other languages supported?', answer: 'Not yet, but they will be added.' },
		{ id: 'faq-9', question: 'How do you make money?', answer: 'We will have a paid monthly subscription for premium features. This is being given away for free to our first 1000 users.' },
	];

	const sectionStyle = {
		marginBottom: 'var(--xl-margin)',
		scrollMarginTop: 'calc(var(--header-height) + var(--large-margin))',
		padding: 'var(--large-margin)',
		backgroundColor: 'var(--dark)',
		borderRadius: 'var(--medium-margin)',
		border: '1px solid var(--darkest)',
        width: '100%',
	};
	const introStyle = {
        alignSelf: 'center',
		marginBottom: 'var(--xl-margin)',
		padding: 'calc(var(--large-margin) * 1.5)',
		background: 'linear-gradient(135deg, var(--darker) 0%, var(--darkest) 100%)',
		borderRadius: 'var(--medium-margin)',
		border: '2px solid var(--dark)',
	};
	const descriptionStyle = {
		marginBottom: 'var(--xl-margin)',
		padding: 'var(--large-margin)',
		backgroundColor: 'var(--dark)',
		borderRadius: 'var(--medium-margin)',
		borderLeft: '4px solid var(--primary)',
		fontStyle: 'italic',
	};
	const headingStyle = {
		marginBottom: 'var(--medium-margin)',
		color: 'var(--primary)',
		fontWeight: '600'
	};
	const faqSectionStyle = {
		marginBottom: 'var(--large-margin)',
		scrollMarginTop: 'calc(var(--header-height) + var(--large-margin))',
		padding: 'var(--large-margin)',
		backgroundColor: 'var(--dark)',
		borderRadius: 'var(--medium-margin)',
		border: '1px solid var(--darkest)',
		borderLeft: '3px solid var(--accent)',
        width: '100%',
	};
	const faqQuestionStyle = {
		marginBottom: 'var(--small-margin)',
		color: 'var(--accent)',
		fontWeight: '600',
	};
	const faqAnswerStyle = {
		paddingLeft: 'var(--medium-margin)',
		color: 'var(--light)',
		lineHeight: '1.6',
        width: '100%',
	};
	const dividerStyle = {
		marginBottom: 'var(--xl-margin)',
        marginTop: 'var(--large-margin)',
		textAlign: 'center'
	};
	const asideHeadingStyle = {
		marginBottom: 'var(--medium-margin)',
		marginTop: 'var(--large-margin)',
		color: 'var(--lightest)',
		fontWeight: '600',
		textTransform: 'uppercase',
		fontSize: '0.75rem',
		letterSpacing: '1px',
		paddingBottom: 'var(--small-margin)',
		borderBottom: '2px solid var(--darkest)'
	};
	const navItemStyle = (isActive) => ({
		padding: 'var(--small-margin)',
		cursor: 'pointer',
		color: isActive ? 'var(--lightest)' : 'var(--light)',
		backgroundColor: isActive ? 'var(--darkest)' : 'transparent',
		borderRadius: 'var(--small-margin)',
		borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
		paddingLeft: 'var(--medium-margin)',
		marginBottom: 'var(--tiny-margin)'
	});

	return (
		<div className="standard-container">
			<div className="channel-feed" style={{ alignItems: 'flex-start' }}>
				<div style={introStyle}>
					<div className="large-text" style={headingStyle}>Introduction to Aether Social</div>
					<div className="small-text" style={{ lineHeight: '1.7', maxWidth: '680px' }}>
						Aether Social is a platform where you can customise and control the algorithms that recommend content to you.
					</div>
				</div>
				<div style={descriptionStyle}>
					<div className="small-text">
						{`Posts are made to feeds. You can apply a custom algorithm using the 'Choose algorithm' button on the right of a feed. ${
							isMobile() ? 'Tap the arrow buttons at the top to open the left and right asides, and swipe to close. ' : ''
						}Go to the explore page on the left aside to discover posts and feeds to follow.`}
					</div>
				</div>
				{sections.map((section) => (
					<div key={section.id} id={section.id} style={sectionStyle}>
						<div className="medium-text underline" style={headingStyle}>{section.title}</div>
						<div className="small-text">{section.content}</div>
					</div>
				))}
				<div style={dividerStyle}>
					<div className="large-text">Frequently Asked Questions</div>
				</div>
				{faqs.map((faq) => (
					<div key={faq.id} id={faq.id} style={faqSectionStyle}>
						<div className="medium-text" style={faqQuestionStyle}>{faq.question}</div>
						<div className="small-text" style={faqAnswerStyle}>{faq.answer}</div>
					</div>
				))}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} style={{ alignItems: 'flex-start' }}>
				<div className="small-text bold" style={asideHeadingStyle}>Introduction</div>
				{sections.map((section) => (
					<div
						key={section.id}
						onClick={() => scrollToSection(section.id)}
						className="tiny-text"
						style={navItemStyle(activeSection === section.id)}
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
					>
						{faq.question}
					</div>
				))}
			</SwipeableAside>
		</div>
	);
};

export default Help;