const AboutSection = () => {
	return (
		<div className="about-section">
			<p className="medium-text" style={{ textDecoration: 'underline' }}>Why Custom Algorithms?</p>
			<p className="small-text">Unlike obscure 'black-box' algorithms used by other platforms, we aim to give users full control over how they are recommended social media content.</p>
			<p className="medium-text" style={{ marginTop: '20px', textDecoration: 'underline' }}>Planned features</p>
			<ul className="small-text" style={{ listStyleType: 'disc' }}>
				<li>-Controllable machine learning personalisations</li>
				<li>-Algorithm sharing between users</li>
				<li>-Feed recommendations, not just posts</li>
				<li>-Image and video based content analysis</li>
			</ul>
            <p className="medium-text" style={{ marginTop: '20px', textDecoration: 'underline' }}>Current limitations</p>
			<p className="small-text">The current implementation is a demonstration prototype. Only text-based content can currently be analysed by our algorithms. You may notice some rankings and recommendations that don't match your expectations. If so, send us some feedbck.</p>
		</div>
	);
};

export default AboutSection;