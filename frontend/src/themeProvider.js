import axios from 'axios';
import React, { createContext, useState, useEffect } from 'react';
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
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
        } finally {
            setIsLoading(false);
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

    //Render nothing until the theme is fetched
    if (isLoading) {
        return null;  
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme: updateTheme, themes }}>
            {children}
        </ThemeContext.Provider>
    );
};