import React from 'react';

const ThemeButton = ({ colors, onThemeSelect, themeName }) => {
	return (
		<button className="button theme" onClick={() => onThemeSelect(themeName)}>
			<p>{themeName.charAt(0).toUpperCase() + themeName.slice(1)}</p>
			<div className="theme-container">
				<div className="theme-box" style={{ backgroundColor: colors.darkest }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.dark }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.buttonHover }}></div>
			</div>
		</button>
	);
};

export default ThemeButton;