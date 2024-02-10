import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();
//Check if user is logged in
export const AuthCheck = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuthentication = async () => {
            try {
                const response = await fetch('/api/check_authentication');
                if (response.ok) {
                    const data= await response.json();
                    setIsAuthenticated(true);
                    setUser(data.user);
                } else if (response.status === 401) {
                    navigate('/login');
                }
            } catch (error) {
                console.error('Error:', error);
            } 
        };
        checkAuthentication();
    }, [navigate]);

    return (
        <AuthContext.Provider value={{ isAuthenticated, user }}>
            {children}
        </AuthContext.Provider>
    );
};
