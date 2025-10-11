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
    white: { border: '#2f2f2f', dark: '#e1e1e1', darkest: '#c7c7c7', light: '#ffffff', lightest: '#dddddd' }
};

const applyTheme = (theme) => {
    if (theme && typeof theme === 'object') {
        Object.entries(theme).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
        });
    }
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        try {
            console.log("theme provider placeholder");
            //const user = JSON.parse(localStorage.getItem("user"));
            //console.log("theme provider user:", user);
            //console.log("theme provider user.theme:", user?.theme);
            //if (user?.theme) {
                //return typeof user.theme === 'string' ? JSON.parse(user.theme) : user.theme;
            //}
        } catch {}
        //return DEFAULT_THEME_COLORS[DEFAULT_THEME];
    });

    //useEffect(() => {
        //applyTheme(theme);
    //}, [theme]);

    const refreshTheme = async () => {
        try {
            console.log("refresh theme placeholder");
            //const user = JSON.parse(localStorage.getItem("user"));
            //console.log("refresh theme user:", user);
            //if (user?.theme) {
                //const themeObject = typeof user.theme === 'string' ? JSON.parse(user.theme) : user.theme;
                //setTheme(themeObject);
                //applyTheme(themeObject);
            //}
        } catch {
            setTheme(DEFAULT_THEME_COLORS[DEFAULT_THEME]);
        }
    };

    const updateTheme = async (newTheme) => {
        try {
            console.log("updating theme placeholder");
            //const themeObject = typeof newTheme === 'string' ? DEFAULT_THEME_COLORS[newTheme] : newTheme;
            //await axios.post('/api/change_theme', { theme: JSON.stringify(themeObject) });
            //const user = JSON.parse(localStorage.getItem("user")) || {};
            //console.log("update theme user:", user);
            //user.theme = themeObject; //Store as object, not string
            //localStorage.setItem("user", JSON.stringify(user));
            //setTheme(themeObject);
        } catch (error) {
            console.error('Error updating theme:', error);
        }
    };

    return (
        <ThemeContext.Provider value={{ defaultThemeColors: DEFAULT_THEME_COLORS, refreshTheme, setTheme: updateTheme, theme, themes: DEFAULT_THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
};

export { DEFAULT_THEME_COLORS, DEFAULT_THEME, applyTheme };