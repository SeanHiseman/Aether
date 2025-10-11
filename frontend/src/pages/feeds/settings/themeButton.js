const ThemeButton = ({ colors, onThemeSelect, themeName }) => {
	return (
		<button className="button theme" onClick={() => onThemeSelect(themeName)}>
			<p className="medium-text">{themeName.charAt(0).toUpperCase() + themeName.slice(1)}</p>
			<div className="theme-container">
				<div className="theme-box" style={{ backgroundColor: colors.darkest }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.dark }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.light }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.border }}></div>
			</div>
		</button>
	);
};

export default ThemeButton;