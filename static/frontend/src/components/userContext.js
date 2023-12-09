import React, { createContext, useContext, useState, useEffect } from 'react';

export const UserContext = createContext(null);

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
    const [user, setUser ] = useState(null);
    useEffect(() => {
        fetch('/get_current_user')
            .then(response => response.json())  
            .then(data => {
                if (data.user_id) {
                    setUser({ user_id: data.user_id});
                }
            })
            .catch(error => {
                console.error("Error fetching user data", error);
            });
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};