import React, { useContext } from 'react';
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';

const Theme = () => {
    const { setTheme } = useContext(ThemeContext);
    const themeColors = {
        dark: { darkest: '#0f0f0f', dark: '#1f2022', buttonHover: '#4a4b55' },
        light: { darkest: '#c7c7c7', dark: '#e1e1e1', buttonHover: '#ffffff' },
        blue: { darkest: '#0b132b', dark: '#1c2541', buttonHover: '#3d52a0' },
        green: { darkest: '#001a0c', dark: '#003325', buttonHover: '#5a8a6c' },
        purple: { darkest: '#13001c', dark: '#240343', buttonHover: '#5b1e7a' },
        red: { darkest: '#160000', dark: '#312626', buttonHover: '#b85c5c' }
    };

    return (
        <div id="profile-settings">
            <div id="display-area">
                {Object.keys(themeColors).map((theme) => (
                    <ThemeButton
                        key={theme}
                        themeName={theme}
                        colors={themeColors[theme]}
                        setTheme={setTheme}
                    />
                ))}
            </div>
        </div>
    );
};

export default Theme;