import { useState } from 'react';
import './RecommendationInfo.css';

const RecommendationInfo = ({ reasons }) => {
	const [showPopup, setShowPopup] = useState(false);

	if (!reasons || reasons.length === 0) return null;

	return (
		<div className="recommendation-info">
			<button
				className="info-icon-button"
				onClick={(e) => {
					e.stopPropagation();
					e.preventDefault();
					setShowPopup(!showPopup);
				}}
				title="Why was this recommended?"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
					<text x="8" y="11" fontSize="10" textAnchor="middle" fill="currentColor">i</text>
				</svg>
			</button>

			{showPopup && (
				<>
					<div className="recommendation-backdrop" onClick={() => setShowPopup(false)} />
					<div className="recommendation-popup">
						<div className="recommendation-popup-header">
							<span>Why this was shown</span>
							<button onClick={() => setShowPopup(false)} className="close-button">×</button>
						</div>
						<ul className="recommendation-reasons">
							{reasons.map((reason, index) => (
								<li key={index}>{reason}</li>
							))}
						</ul>
						<div className="recommendation-popup-footer">
							<small>These scores determine post ranking</small>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

export default RecommendationInfo;
