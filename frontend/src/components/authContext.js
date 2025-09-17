import axios from 'axios';
import React, { createContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const PublicAuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [viewer, setViewer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const contextValue = useMemo(() => {
        return { isAuthenticated, user, viewer, isLoading };
    }, [isAuthenticated, user, viewer, isLoading]);

    useEffect(() => {
        const checkAuthentication = async () => {
            try {
                const response = await axios.get('/api/check_authentication');
                const { authenticated, feeds, user, currentFeed } = response.data;
                if (authenticated && user) {
                    setIsAuthenticated(true);
                    setUser(user);
                    if (feeds && currentFeed) {
                        const selectedFeed = feeds.find(feed => feed?.feed_id === currentFeed);
                        if (selectedFeed && (!viewer || viewer?.feed_id !== selectedFeed?.feed_id)) {
                            setViewer(selectedFeed);
                        }
                    }
                } else {
                    setIsAuthenticated(false);
                    setUser(null);
                    setViewer(null);
                }
            } catch (error) {
                setIsAuthenticated(false);
                setUser(null);
                setViewer(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuthentication();
    }, []);

    return (
        <AuthContext.Provider value={contextValue}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

export const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = React.useContext(AuthContext);
    const navigate = useNavigate();
    
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login', { 
                state: { from: window.location.pathname },
                replace: true 
            });
        }
    }, [isAuthenticated, isLoading, navigate]);
    
    if (isLoading) return <div>Loading...</div>;
    if (!isAuthenticated) return null;

    return children;
};