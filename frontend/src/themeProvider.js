import axios from 'axios';
import React, { createContext, useState, useEffect } from 'react';
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState('dark');
    const themes = ['dark', 'light', 'blue', 'green', 'purple', 'red'];

    useEffect(() => {
        fetchTheme();
    }, []);

    useEffect(() => {
        if (theme) {
            document.body.className = theme;
        }
    }, [theme]);

    const fetchTheme = async () => {
        try {
            const response = await axios.get('/api/get_theme');
            setTheme(response.data.theme);
        } catch (error) {
            //Default theme 
            setTheme('dark');
        }
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
        <ThemeContext.Provider value={{ theme, setTheme: updateTheme, themes }}>
            {children}
        </ThemeContext.Provider>
    );
};