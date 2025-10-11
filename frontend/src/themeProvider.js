import axios from 'axios';
import { createContext, useEffect, useState } from 'react';
export const ThemeContext = createContext();

const DEFAULT_THEME = 'dark';
const DEFAULT_THEMES = ['blue','dark','green','white','purple','red'];
const DEFAULT_THEME_COLORS = {
    blue: { border: '#dddddd', dark: '#273049', darkest: '#0b132b', light: '#3d52a0', lightest: '#dddddd' },
    dark: { border: '#3e3f41', dark: '#232527', darkest: '#0f0f0f', light: '#737484', lightest: '#dddddd' },
    green: { border: '#dddddd', dark: '#003325', darkest: '#001a0c', light: '#5a8a6c', lightest: '#dddddd' },
    red: { border: '#dddddd', dark: '#312626', darkest: '#210303', light: '#873333', lightest: '#dddddd' },
    purple: { border: '#dddddd', dark: '#240343', darkest: '#13001c', light: '#5b1e7a', lightest: '#dddddd' },
    white: { border: '#2f2f2f', dark: '#e1e1e1', darkest: '#c7c7c7', light: '#9b9b9bff', lightest: '#171717ff' }
};

const applyTheme = (theme) => {
	if (typeof theme === 'string' && DEFAULT_THEMES.includes(theme)) {
		document.body.className = theme;
		['border','dark','darkest','light','lightest'].forEach((key) => {
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
	const [theme, setTheme] = useState(() => {
		try {
			const user = JSON.parse(localStorage.getItem("user"));
			const userTheme = user?.theme;
			if (typeof userTheme === 'string' && userTheme.startsWith('{')) {
				return JSON.parse(userTheme);
			}
			return userTheme || DEFAULT_THEME;
		} catch {
			return DEFAULT_THEME;
		}
	});
	
	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	const refreshTheme = () => {
		try {
			const user = JSON.parse(localStorage.getItem("user"));
			if (user?.theme) {
				const themeToApply = typeof user.theme === 'string' && user.theme.startsWith('{') 
					? JSON.parse(user.theme) 
					: user.theme;
				setTheme(themeToApply);
				applyTheme(themeToApply); 
			} else {
				setTheme(DEFAULT_THEME);
				applyTheme(DEFAULT_THEME);
			}
		} catch {
			setTheme(DEFAULT_THEME);
			applyTheme(DEFAULT_THEME);
		}
	};

	const updateTheme = async (newTheme) => {
		try {
			await axios.post('/api/change_theme', { theme: newTheme });
			const user = JSON.parse(localStorage.getItem("user")) || {};
			user.theme = newTheme;
			localStorage.setItem("user", JSON.stringify(user));
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

export { DEFAULT_THEME_COLORS, DEFAULT_THEME, applyTheme };