import { AuthContext } from '../../../components/authContext';
import { Crown } from 'lucide-react';
import { Link } from "react-router-dom";
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';
import { useContext, useEffect, useState } from 'react';

const Theme = () => {
    const { defaultThemeColors, setTheme: updateTheme, theme, themes } = useContext(ThemeContext);
    console.log("theme:", theme);
    const { isAuthenticated, user } = useContext(AuthContext);
    const [customTheme, setCustomTheme] = useState(theme || defaultThemeColors['dark']);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');

    useEffect(() => {
        if (theme) {
            setCustomTheme(theme);
        }
    }, [theme]);

    const handleColorChange = (key, value) => {
        if (!customTheme) return;
        const updated = { ...customTheme, [key]: value };
        setCustomTheme(updated);
        document.documentElement.style.setProperty(`--${key}`, value);
    };

    const handleCustomThemeSave = async () => {
        if (!isAuthenticated) return;
        try {
            await updateTheme(customTheme);
            setFeedbackMessage('Theme updated');
            setTimeout(() => { setFeedbackMessage(''); }, 5000);
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error changing theme');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const handleDefaultThemeSelect = async (themeName) => {
        if (!isAuthenticated) return;
        try {
            const themeColors = defaultThemeColors[themeName];
            await updateTheme(themeColors);
            setCustomTheme(themeColors); // Update local state immediately
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error changing theme');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };
    console.log("customTheme:", customTheme);
    return (
        <div className="feed-settings">
            <p className="large-text">Choose your theme</p>
            <div className="display-area" style={{ display: 'grid' }}>
                {themes.map((themeName) => (
                    <ThemeButton key={themeName} colors={defaultThemeColors[themeName]} onThemeSelect={handleDefaultThemeSelect} themeName={themeName} />
                ))}
            </div>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <div className="custom-theme-container">
                {user?.has_membership ? (
                    <>
                        <p className="medium-text">Custom Theme</p>
                        <div className="custom-theme-preview">
                            {['darkest', 'dark', 'light', 'lightest', 'border'].map((key) => (
                                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <input type="color" className="custom-theme-input" value={customTheme?.[key] || '#000000'} onChange={(e) => handleColorChange(key, e.target.value)} />
                                    <span style={{ margin: '5px' }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                </div>
                            ))}
                        </div>
                        <button className="button" onClick={handleCustomThemeSave}>{feedbackMessage || 'Apply custom theme'}</button>
                    </>
                ) : (
                    <Link className="small-icon" to={`/settings/${user?.username}/membership`} title="View Membership">
                        <Crown />
                        <p className="icon-text">Create custom themes with membership</p>
                    </Link>
                )}
            </div>
        </div>
    );
};

export default Theme;