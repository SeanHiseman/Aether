import api from './api';
import { HexToRgb } from './functions/hexToRgb';
import { createContext, useEffect, useState } from 'react';
export const ThemeContext = createContext();

const DEFAULT_THEME = 'dark';
const DEFAULT_THEMES = ['dark','blue','green','white','purple','red'];
const DEFAULT_THEME_COLORS = {
	dark: { border: '#3e3f41', dark: '#232527', darkest: '#0f0f0f', light: '#737484', lightest: '#dddddd' },
    blue: { border: '#dddddd', dark: '#273049', darkest: '#0b132b', light: '#3d52a0', lightest: '#8da2cdff' },
    green: { border: '#dddddd', dark: '#003325', darkest: '#001a0c', light: '#5a8a6c', lightest: '#a1e8a2ff' },
    red: { border: '#dddddd', dark: '#312626', darkest: '#210303', light: '#873333', lightest: '#f1b7b7ff' },
    purple: { border: '#dddddd', dark: '#240343', darkest: '#13001c', light: '#5b1e7a', lightest: '#e2a4daff' },
    white: { border: '#2f2f2f', dark: '#e1e1e1', darkest: '#c7c7c7', light: '#717171ff', lightest: '#383838ff' }
};

const applyTheme = (theme) => {
	if (typeof theme === 'string' && DEFAULT_THEMES.includes(theme)) {
		document.body.className = theme;
		//Apply the default theme colors with sRGB specification
		const themeColors = DEFAULT_THEME_COLORS[theme];
		Object.entries(themeColors).forEach(([key, value]) => {
			const cssColor = `color(srgb ${HexToRgb(value)})`;
			document.documentElement.style.setProperty(`--${key}`, cssColor);
		});
	} else if (theme && typeof theme === 'object') {
		document.body.className = '';
		Object.entries(theme).forEach(([key, value]) => {
			//Convert hex colors to sRGB for consistency across devices
			const cssColor = value.startsWith('#') ? `color(srgb ${HexToRgb(value)})` : value;
			document.documentElement.style.setProperty(`--${key}`, cssColor);
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
			await api.post('/change_theme', { theme: newTheme });
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