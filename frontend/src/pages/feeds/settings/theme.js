import React, { useContext, useEffect, useState } from 'react';
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';

const Theme = () => {
	const { defaultThemeColors, setTheme: updateTheme, theme, themes } = useContext(ThemeContext);
	const isDefaultTheme = typeof theme === 'string';
	const initialCustomTheme = (!isDefaultTheme && theme) || { border: '#323437', dark: '#232527', darkest: '#0f0f0f', light: '#737484', lightest: '#dddddd' };
	const [customTheme, setCustomTheme] = useState(initialCustomTheme);
	const [errorMessage, setErrorMessage] = useState('');
	const [feedbackMessage, setFeedbackMessage] = useState('');

	useEffect(() => {
		if (typeof theme === 'object') {
			setCustomTheme(theme);
		}
	}, [theme]);

	const handleColorChange = (key, value) => {
		const updated = { ...customTheme, [key]: value };
		setCustomTheme(updated);
		document.documentElement.style.setProperty(`--${key}`, value);
	};

	const handleCustomThemeSave = async () => {
		try {
			await updateTheme(customTheme);
			setFeedbackMessage('Theme updated');
			setTimeout(() => { setFeedbackMessage(''); }, 5000);
		} catch {
			setErrorMessage('Error changing theme');
			setTimeout(() => { setErrorMessage(''); }, 5000);
		}
	};

	const handleDefaultThemeSelect = async (themeName) => {
		try {
			await updateTheme(themeName);
		} catch {
			setErrorMessage('Error changing theme');
			setTimeout(() => { setErrorMessage(''); }, 5000);
		}
	};
	
	return (
		<div className="feed-settings">
			<p className="text36">Choose your theme</p>
			<div className="display-area" style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
				{themes.map((themeName) => (
					<ThemeButton key={themeName} colors={defaultThemeColors[themeName]} onThemeSelect={handleDefaultThemeSelect} themeName={themeName} />
				))}
			</div>
			{errorMessage && <p className="error-message">{errorMessage}</p>}
			<div className="custom-theme-container">
				<p className="text24">Custom Theme</p>
				<div className="custom-theme-preview">
					{['darkest','dark','light','lightest','border'].map((key) => (
						<div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
							<input type="color" className="custom-theme-input" value={customTheme[key] || '#000000'} onChange={(e) => handleColorChange(key, e.target.value)} />
							<span style={{ margin: '5px' }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
						</div>
					))}
				</div>
				<button className="button" onClick={handleCustomThemeSave}>Save Custom Theme</button>
				{feedbackMessage && <p className="feedback-message">{feedbackMessage}</p>}
			</div>
		</div>
	);
};

export default Theme;