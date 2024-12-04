import React, { useContext } from 'react';
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';

const Theme = ({ user, setCurrentView }) => {
    const { setTheme } = useContext(ThemeContext);
    const themeColors = {
        dark: { darkest: '#0f0f0f', dark: '#2c2e31', buttonHover: '#737484' },
        light: { darkest: '#c7c7c7', dark: '#e1e1e1', buttonHover: '#ffffff' },
        blue: { darkest: '#0b132b', dark: '#273049', buttonHover: '#3d52a0' },
        green: { darkest: '#001a0c', dark: '#003325', buttonHover: '#5a8a6c' },
        purple: { darkest: '#13001c', dark: '#240343', buttonHover: '#5b1e7a' },
        red: { darkest: '#210303', dark: '#312626', buttonHover: '#873333' }
    };

    const availableThemes = user.has_membership ? themeColors : { light: themeColors.light, dark: themeColors.dark };

    return (
        <div className="feed-settings">
            <div className="display-area">
                {Object.keys(availableThemes).map((theme) => (
                    <ThemeButton
                        key={theme}
                        themeName={theme}
                        colors={themeColors[theme]}
                        setTheme={setTheme}
                    />
                ))}
                {!user.hasMembership && (
                    <div className="membership-join">
                        <p className="text24">More themes available with membership</p>
                        <button className="button join" onClick={() => setCurrentView('membership-settings')}>Join</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Theme;