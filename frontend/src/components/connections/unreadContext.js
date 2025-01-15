import axios from 'axios';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { AuthContext } from '../authContext';

export const UnreadContext = createContext();

const unreadReducer = (state, action) => {
    switch (action.type) {
        case 'SET_UNREAD_COUNTS':
            return {
                total: action.payload.total,
                feedCounts: action.payload.feedCounts, 
                chatCounts: action.payload.chatCounts 
            };
        case 'INCREMENT_UNREAD':
            return {
                ...state,
                total: state.total + 1,
                chatCounts: {
                    ...state.chatCounts,
                    [action.chatId]: (state.chatCounts[action.chatId] || 0) + 1
                }
            };
        case 'MARK_AS_READ':
            const unreadCount = state.chatCounts[action.chatId] || 0;
            return {
                ...state,
                total: state.total - unreadCount,
                chatCounts: {
                    ...state.chatCounts,
                    [action.chatId]: 0
                }
            };
        default:
            return state;
    }
};

export const UnreadProvider = ({ children }) => {
    const [state, dispatch] = useReducer(unreadReducer, { total: 0, chatCounts: {}, feedCounts: {} });
    const { viewer } = useContext(AuthContext);

    useEffect(() => {
        const fetchUnreadCounts = async () => {
            try {
                const response = await axios.get(`/api/unread_messages_count/${viewer.feed_id}`);
                if (response.data.success) {
                    dispatch({ 
                        type: 'SET_UNREAD_COUNTS', 
                        payload: {
                            total: response.data.total,
                            chatCounts: response.data.chatCounts,
                            feedCounts: response.data.feedCounts
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to fetch unread counts:', error);
            }
        };

        if (viewer.feed_id) {
            fetchUnreadCounts();
        }
    }, [viewer.feed_id]);

    return (
        <UnreadContext.Provider value={{ state, dispatch }}>
            {children}
        </UnreadContext.Provider>
    );
};