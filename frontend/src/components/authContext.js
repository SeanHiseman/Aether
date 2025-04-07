import axios from 'axios';
import React, { createContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const PublicAuthProvider = ({ children }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [user, setUser] = useState(null);
	const [viewer, setViewer] = useState(null);

    //Prevents rerendering
    const contextValue = useMemo(() => {
        return { isAuthenticated, user, viewer };
    }, [isAuthenticated, user, viewer]);

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
						if (!viewer || viewer.feed_id !== selectedFeed.feed_id) {
							setViewer(selectedFeed);
						}
					}
				} else {
					//User is not authenticated but can still view content
					setIsAuthenticated(false);
					setUser(null);
					setViewer(null);
				}
			} catch (error) {
				//Viewing allowed but not authenticated
				setIsAuthenticated(false);
				setUser(null);
				setViewer(null);
			}
		};
		checkAuthentication();
	}, []);

	return (
		<AuthContext.Provider value={contextValue}>
			{children}
		</AuthContext.Provider>
	);
};

//Protect routes that require authentication
export const ProtectedRoute = ({ children }) => {
	const { isAuthenticated } = React.useContext(AuthContext);
	const navigate = useNavigate();
	
	useEffect(() => {
		if (!isAuthenticated) {
			navigate('/login', { state: { from: window.location.pathname } });
		}
	}, [isAuthenticated, navigate]);
	
	if (!isAuthenticated) {
		return null;
	}
	
	return children;
};