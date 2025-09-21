import axios from 'axios';
import { createContext, useEffect, useState } from 'react';
export const ThemeContext = createContext();

const DEFAULT_THEME = 'dark';
const DEFAULT_THEMES = ['blue','dark','green','white','purple','red'];
const DEFAULT_THEME_COLORS = {
	blue: { border: '#dddddd', dark: '#273049', darkest: '#0b132b', light: '#3d52a0' },
	dark: { border: '#dddddd', dark: '#2c2e31', darkest: '#0f0f0f', light: '#737484' },
	green: { border: '#dddddd', dark: '#003325', darkest: '#001a0c', light: '#5a8a6c' },
	red: { border: '#dddddd', dark: '#312626', darkest: '#210303', light: '#873333' },
	purple: { border: '#dddddd', dark: '#240343', darkest: '#13001c', light: '#5b1e7a' },
	white: { border: '#2f2f2f', dark: '#e1e1e1', darkest: '#c7c7c7', light: '#ffffff' }
};

const applyTheme = (theme) => {
	if (typeof theme === 'string' && DEFAULT_THEMES.includes(theme)) {
		document.body.className = theme;
		['border','dark','darkest','light'].forEach((key) => {
			document.documentElement.style.removeProperty(`--${key}`);
		});
	} else if (theme && typeof theme === 'object') {
		document.body.className = '';
		Object.entries(theme).forEach(([key, value]) => {
			document.documentElement.style.setProperty(`--${key}`, value);
		});
	}
};

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(DEFAULT_THEME);
	
	useEffect(() => {
		fetchTheme();
	}, []);
	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	const fetchTheme = async () => {
		try {
			const response = await axios.get('/api/get_theme');
			let fetchedTheme = response.data?.theme;
			try {
				const parsedTheme = JSON.parse(fetchedTheme);
				setTheme(parsedTheme);
			} catch {
				if (DEFAULT_THEMES.includes(fetchedTheme)) {
					setTheme(fetchedTheme);
				} else {
					setTheme(DEFAULT_THEME);
				}
			}
		} catch {
			setTheme(DEFAULT_THEME);
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
		<ThemeContext.Provider value={{ defaultThemeColors: DEFAULT_THEME_COLORS, refreshTheme, setTheme: updateTheme, theme, themes: DEFAULT_THEMES }}>
			{children}
		</ThemeContext.Provider>
	);
};