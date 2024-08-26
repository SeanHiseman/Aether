import React, { useContext } from 'react';
import { ThemeContext } from '../../../themeProvider';

const Theme = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <div id="profile-settings">
            <div id="display-area">
                <button className="button" onClick={toggleTheme}>
                    Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </button>
            </div>
        </div>
    );
};

export default Theme;