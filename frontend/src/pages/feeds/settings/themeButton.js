const ThemeButton = ({ colors, onThemeSelect, themeName }) => {
	return (
		<button className="button theme" onClick={() => onThemeSelect(themeName)}>
			<p>{themeName.charAt(0).toUpperCase() + themeName.slice(1)}</p>
			<div className="theme-container" style={{ display: 'flex', flexDirection: window.innerWidth <= 768 ? 'column' : 'row', gap: '4px' }}>
				<div className="theme-box" style={{ backgroundColor: colors.darkest }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.dark }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.light }}></div>
				<div className="theme-box" style={{ backgroundColor: colors.border }}></div>
			</div>
		</button>
	);
};

export default ThemeButton;