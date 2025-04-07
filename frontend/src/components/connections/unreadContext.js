import axios from 'axios';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { AuthContext } from '../authContext';

export const UnreadContext = createContext();

const unreadReducer = (state, action) => {
    switch (action.type) {
        case 'SET_UNREAD_COUNTS':
            return {
                total: action.payload.total + (action.payload.requestCount || 0),
                feedCounts: action.payload.feedCounts,
                chatCounts: action.payload.chatCounts,
                requestCount: action.payload.requestCount || 0
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
        case 'SET_REQUEST_COUNT':
            const oldRequestCount = state.requestCount || 0;
            return {
                ...state,
                requestCount: action.count,
                total: state.total - oldRequestCount + action.count
            };
        case 'INCREMENT_REQUEST_COUNT':
            return {
                ...state,
                requestCount: (state.requestCount || 0) + 1,
                total: state.total + 1
            };
        case 'DECREMENT_REQUEST_COUNT':
            const newRequestCount = Math.max(0, (state.requestCount || 0) - action.count);
            return {
                ...state,
                requestCount: newRequestCount,
                total: state.total - action.count
            };
        default:
            return state;
    }
};

export const UnreadProvider = ({ children }) => {
    const [state, dispatch] = useReducer(unreadReducer, { 
        total: 0, 
        chatCounts: {}, 
        feedCounts: {},
        requestCount: 0
    });
    const { isAuthenticated, viewer } = useContext(AuthContext);
    
    useEffect(() => {
        if (!isAuthenticated || !viewer) return;
        const fetchUnreadCounts = async () => {
            try {
                const messageResponse = await axios.get(`/api/unread_messages_count/${viewer.feed_id}`);
                const requestResponse = await axios.get('/api/get_connect_requests', { 
                    params: { feedId: viewer.feed_id, offset: 0 } 
                });
                
                const requestCount = requestResponse.data.requests ? requestResponse.data.requests.length : 0;
                
                if (messageResponse.data.success) {
                    dispatch({
                        type: 'SET_UNREAD_COUNTS',
                        payload: {
                            total: messageResponse.data.total,
                            chatCounts: messageResponse.data.chatCounts,
                            feedCounts: messageResponse.data.feedCounts,
                            requestCount: requestCount
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to fetch unread counts:', error);
            }
        };
        fetchUnreadCounts();
        const socket = window.socket; 
        if (socket) {
            socket.on('chat_message_confirmed', (message) => {
                if (message.receiver_id === viewer.feed_id && !message.is_read) {
                    dispatch({
                        type: 'INCREMENT_UNREAD',
                        chatId: message.chat_id
                    });
                }
            });
            socket.on('messages_marked_read', (data) => {
                if (data.reader_id === viewer.feed_id) {
                    dispatch({
                        type: 'MARK_AS_READ',
                        chatId: data.chat_id
                    });
                }
            });
            socket.on('new_connect_request', () => {
                dispatch({ type: 'INCREMENT_REQUEST_COUNT' });
            });
            socket.on('connect_request_resolved', (data) => {
                if (data.count && data.count > 0) {
                    dispatch({ 
                        type: 'DECREMENT_REQUEST_COUNT',
                        count: data.count || 1
                    });
                }
            });
        }
        return () => {
            if (socket) {
                socket.off('chat_message_confirmed');
                socket.off('messages_marked_read');
                socket.off('new_connect_request');
                socket.off('connect_request_resolved');
            }
        };
    }, [viewer]);
    
    return (
        <UnreadContext.Provider value={{ state, dispatch }}>
            {children}
        </UnreadContext.Provider>
    );
};