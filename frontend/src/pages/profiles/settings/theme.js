import React, { useContext } from 'react';
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';

const Theme = ({ user, setCurrentView }) => {
    const { setTheme } = useContext(ThemeContext);
    const themeColors = {
        dark: { darkest: '#0f0f0f', dark: '#1f2022', buttonHover: '#4a4b55' },
        light: { darkest: '#c7c7c7', dark: '#e1e1e1', buttonHover: '#ffffff' },
        blue: { darkest: '#0b132b', dark: '#1c2541', buttonHover: '#3d52a0' },
        green: { darkest: '#001a0c', dark: '#003325', buttonHover: '#5a8a6c' },
        purple: { darkest: '#13001c', dark: '#240343', buttonHover: '#5b1e7a' },
        red: { darkest: '#160000', dark: '#312626', buttonHover: '#b85c5c' }
    };

    const availableThemes = user.hasMembership ? themeColors : { light: themeColors.light, dark: themeColors.dark };

    return (
        <div id="profile-settings">
            <div id="display-area">
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