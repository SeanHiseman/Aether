import { AuthContext } from '../../../components/authContext';
import { Crown } from 'lucide-react';
import { HexToRgb } from '../../../functions/hexToRgb';
import { Link } from "react-router-dom";
import { ThemeContext } from '../../../themeProvider';
import ThemeButton from './themeButton';
import { useContext, useEffect, useState } from 'react';

const Theme = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const { defaultThemeColors, setTheme: updateTheme, theme, themes } = useContext(ThemeContext);
    const { isAuthenticated, user } = useContext(AuthContext);
    
	const getInitialTheme = () => {
		if (theme) {
			//Theme can be string or object
			if (typeof theme === 'string' && theme.startsWith('{')) {
				try {
					return JSON.parse(theme);
				} catch (error) {
					console.error('Failed to parse theme JSON:', error);
					return defaultThemeColors[theme] || defaultThemeColors['dark'];
				}
			}
			if (typeof theme === 'string') {
				return defaultThemeColors[theme] || defaultThemeColors['dark'];
			}
			if (typeof theme === 'object') {
				return theme;
			}
		}
		return defaultThemeColors['dark'];
	};
    
    const [customTheme, setCustomTheme] = useState(getInitialTheme);

	useEffect(() => {
		if (theme) {
			if (typeof theme === 'string' && theme.startsWith('{')) {
				try {
					const parsedTheme = JSON.parse(theme);
					setCustomTheme(parsedTheme);
				} catch (error) {
					setCustomTheme(defaultThemeColors['dark']);
				}
			}
			else if (typeof theme === 'string') {
				setCustomTheme(defaultThemeColors[theme] || defaultThemeColors['dark']);
			}
			else if (typeof theme === 'object') {
				setCustomTheme(theme);
			}
		}
	}, [theme]);

    const handleColorChange = (key, value) => {
        if (!customTheme) return;
        const updated = { ...customTheme, [key]: value };
        setCustomTheme(updated);
        //Convert hex to sRGB color function for consistency
        const cssColor = `color(srgb ${HexToRgb(value)})`;
        document.documentElement.style.setProperty(`--${key}`, cssColor);
    };

    const handleCustomThemeSave = async () => {
        if (!isAuthenticated) return;
        try {
            await updateTheme(customTheme);
            setFeedbackMessage('Theme updated');
            setTimeout(() => { setFeedbackMessage(''); }, 5000);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error changing theme');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const handleDefaultThemeSelect = async (themeName) => {
        if (!isAuthenticated) return;
        try {
            const themeColors = defaultThemeColors[themeName];
            await updateTheme(themeColors); 
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error changing theme');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };
    
    document.title = "Colour theme";
    return (
        <div className="feed-settings">
            <p className="large-text">Choose your colour theme</p>
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
                            {['darkest', 'dark', 'light', 'lightest'].map((key) => (
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