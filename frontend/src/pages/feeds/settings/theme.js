import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';

const Theme = () => {
	const { setTheme: updateTheme, theme } = useContext(ThemeContext);
	const themeColors = {
		blue: { buttonHover: '#3d52a0', dark: '#273049', darkest: '#0b132b' },
		dark: { buttonHover: '#737484', dark: '#2c2e31', darkest: '#0f0f0f' },
		green: { buttonHover: '#5a8a6c', dark: '#003325', darkest: '#001a0c' },
		light: { buttonHover: '#ffffff', dark: '#e1e1e1', darkest: '#c7c7c7' },
		purple: { buttonHover: '#5b1e7a', dark: '#240343', darkest: '#13001c' },
		red: { buttonHover: '#873333', dark: '#312626', darkest: '#210303' }
	};
	const [customTheme, setCustomTheme] = useState(theme || themeColors.dark);
	const [errorMessage, setErrorMessage] = useState('');
	const [feedbackMessage, setFeedbackMessage] = useState('');

	const parseTheme = (theme) => {
		if (typeof theme === 'string') {
			try {
				return JSON.parse(theme);
			} catch (error) {
				setErrorMessage('Error parsing theme');
				return themeColors.dark; //Fallback to dark theme
			}
		}
		return theme || themeColors.dark;
	};

	useEffect(() => {
		const parsedTheme = parseTheme(theme);
		setCustomTheme(parsedTheme);
		document.documentElement.style.setProperty('--button-hover', parsedTheme.buttonHover);
		document.documentElement.style.setProperty('--dark', parsedTheme.dark);
		document.documentElement.style.setProperty('--darkest', parsedTheme.darkest);
	}, [theme]);

	const handleColorChange = (key, value) => {
		const updated = { ...customTheme, [key]: value };
		setCustomTheme(updated);
		document.documentElement.style.setProperty(`--${key}`, value);
	};

	const handleCustomThemeSave = async () => {
		try {
			updateTheme(customTheme);
			await axios.post('/api/change_theme', { theme: customTheme });
			setFeedbackMessage('Theme updated');
		} catch (error) {
			console.log(error);
			setErrorMessage('Error changing theme');
		}
	};

	const handleDefaultThemeSelect = async (themeKey) => {
		try {
			const themeObj = themeColors[themeKey];
			updateTheme(themeObj);
			setCustomTheme(themeObj);
			await axios.post('/api/change_theme', { theme: themeObj });
		} catch (error) {
			console.log(error);
			setErrorMessage('Error changing theme');
		}
	};

	return (
		<div className="feed-settings">
			<p className="text36">Choose your theme</p>
			<div className="display-area" style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
				{Object.keys(themeColors).map((key) => (
					<ThemeButton key={key} colors={themeColors[key]} onThemeSelect={handleDefaultThemeSelect} themeName={key} />
				))}
			</div>
			{errorMessage && <p className="error-message">{errorMessage}</p>}
			<div className="custom-theme-container">
				<p className="text24">Custom Theme</p>
				<div className="custom-theme-preview">
					{['darkest', 'dark', 'light'].map((key) => (
						<div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
							<input
								type="color"
								className="custom-theme-input"
								value={customTheme[key] || '#000000'}
								onChange={(e) => handleColorChange(key, e.target.value)}
							/>
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