import axios from 'axios';
import React, { createContext, useState, useEffect } from 'react';
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
	const themeColors = {
		blue: { buttonHover: '#3d52a0', dark: '#273049', darkest: '#0b132b' },
		dark: { buttonHover: '#737484', dark: '#2c2e31', darkest: '#0f0f0f' },
		green: { buttonHover: '#5a8a6c', dark: '#003325', darkest: '#001a0c' },
		light: { buttonHover: '#ffffff', dark: '#e1e1e1', darkest: '#c7c7c7' },
		purple: { buttonHover: '#5b1e7a', dark: '#240343', darkest: '#13001c' },
		red: { buttonHover: '#873333', dark: '#312626', darkest: '#210303' }
	};
	const [theme, setTheme] = useState({ buttonHover: '#737484', dark: '#2c2e31', darkest: '#0f0f0f' });

	useEffect(() => {
		fetchTheme();
	}, []);

	useEffect(() => {
		if (theme && typeof theme === 'object') {
			document.documentElement.style.setProperty('--button-hover', theme.buttonHover);
			document.documentElement.style.setProperty('--dark', theme.dark);
			document.documentElement.style.setProperty('--darkest', theme.darkest);
		}
	}, [theme]);

	const fetchTheme = async () => {
		try {
			const response = await axios.get('/api/get_theme');
			let fetchedTheme = response.data.theme;
			try {
				const parsedTheme = JSON.parse(fetchedTheme);
				setTheme(parsedTheme);
			} catch (e) {
				const themeObj = themeColors[fetchedTheme];
				setTheme(themeObj || { buttonHover: '#737484', dark: '#2c2e31', darkest: '#0f0f0f' });
			}
		} catch (error) {
			setTheme({ buttonHover: '#737484', dark: '#2c2e31', darkest: '#0f0f0f' });
		}
	};

	const refreshTheme = async () => {
		await fetchTheme();
	};

	const updateTheme = async (newTheme) => {
		try {
			await axios.post('/api/change_theme', { theme: newTheme });
			setTheme(newTheme);
		} catch (error) {
			console.error('Error updating theme');
		}
	};

	return (
		<ThemeContext.Provider value={{ refreshTheme, setTheme: updateTheme, theme, themes: Object.keys(themeColors) }}>
			{children}
		</ThemeContext.Provider>
	);
};