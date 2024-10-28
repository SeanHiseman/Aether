import axios from 'axios';
import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
export const AuthContext = createContext();

export const AuthCheck = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState({user: ''});
    const [viewer, setViewer] = useState({viewer: ''});
    const navigate = useNavigate();
    useEffect(() => {
        const checkAuthentication = async () => {
            try {
                const response = await axios.get('/api/check_authentication');
                const { authenticated, feeds, user, currentFeed } = response.data;
                if (authenticated) {
                    setIsAuthenticated(true);
                    setUser(user);
                    const selectedFeed = feeds.find(feed => feed.feed_id === currentFeed);
                    if (selectedFeed) {
                        setViewer(selectedFeed);
                    }
                }
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            }
        };
        checkAuthentication();
    }, [navigate]);

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, viewer}}>
            {children}
        </AuthContext.Provider>
    );
};
