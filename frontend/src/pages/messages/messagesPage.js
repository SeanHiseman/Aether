import api from '../../api';
import { AuthContext } from '../../components/authContext';
import ConfirmModal from '../../components/modals/confirmModal';
import ConnectionWidget from './connectionWidget';
import FeedItem from '../../components/channels/feedItem';
import SwipeableAside from '../../components/swipeableAside';
import { useOutletContext } from 'react-router-dom';
import { UnreadContext } from '../../components/messages/unreadContext';
import { useContext, useEffect, useState } from 'react';

const MessagesPage = () => {
    const [activeTab, setActiveTab] = useState('connections');
    const [connections, setConnections] = useState([]);
    const [connectionsOffset, setConnectionsOffset] = useState(0);
    const [connectionToRemove, setConnectionToRemove] = useState(null);
    const [connectRequests, setConnectRequests] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [hasMoreConnections, setHasMoreConnections] = useState(true);
    const [hasMoreRequests, setHasMoreRequests] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [requestsOffset, setRequestsOffset] = useState(0);
    const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 
    const { dispatch } = useContext(UnreadContext);
    const { viewer } = useContext(AuthContext);

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

    const loadMoreConnections = async () => {
        try {
            if (viewer?.feed_id) {
                const response = await api.get('/get_connections', { params: { feedId: viewer?.feed_id, offset: connectionsOffset } });
                const newConnections = response.data?.connections || [];
                if (newConnections.length < 50) {
                    setHasMoreConnections(false);
                }
                setConnections(prevConnections => {
                    const updated = [...prevConnections, ...newConnections];
                    localStorage.setItem('connections', JSON.stringify(updated));
                    return updated;
                });
                setConnectionsOffset(prevOffset => prevOffset + newConnections.length);
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error getting connections');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const loadMoreRequests = async () => {
        try {
            if (viewer?.feed_id) {
                const response = await api.get('/get_connect_requests', { params: { feedId: viewer?.feed_id, offset: requestsOffset } });
                const newRequests = response.data?.requests || [];
                if (newRequests.length < 50) {
                    setHasMoreRequests(false);
                }
                setConnectRequests(prevRequests => [...prevRequests, ...newRequests]);
                setRequestsOffset(prevOffset => prevOffset + newRequests.length);
                dispatch({ 
                    type: 'SET_REQUEST_COUNT',
                    count: newRequests.length 
                });
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error getting connect requests');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    useEffect(() => {
        if (viewer?.feed_id) {
            setConnections([]);
            setConnectRequests([]);
            setConnectionsOffset(0);
            setHasMoreConnections(true);
            setRequestsOffset(0);
            setHasMoreRequests(true);
            loadMoreRequests();
            const socket = window.socket; 
            if (socket) {
				socket.on('new_connect_request', async () => {
					setRequestsOffset(0);
					setHasMoreRequests(true);
					try {
						const response = await api.get('/get_connect_requests', { 
							params: { feedId: viewer?.feed_id, offset: 0 } 
						});
						const newRequests = response.data?.requests || [];
						setConnectRequests(newRequests);
						setRequestsOffset(newRequests.length);
						dispatch({ 
							type: 'SET_REQUEST_COUNT',
							count: newRequests.length 
						});
					} catch (error) {
						setErrorMessage(error.response.data?.message || 'Error getting connect requests');
                        setTimeout(() => { setErrorMessage(''); }, 5000);
					}
				});
            }
            return () => {
                if (socket) {
                    socket.off('new_connect_request');
                }
            };
        }
    }, [viewer.feed_id, dispatch]);

    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.pageYOffset >= document.body.offsetHeight - 50) {
                if (activeTab === 'connections' && hasMoreConnections) {
                    loadMoreConnections();
                }
                if (activeTab === 'requests' && hasMoreRequests) {
                    loadMoreRequests();
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [activeTab, hasMoreConnections, hasMoreRequests, connectionsOffset, requestsOffset, viewer?.feed_id]);

    const handleConnectionAddition = newConnection => {
        if (newConnection) {
            setConnections(prevConnections => {
                const updated = [...prevConnections, newConnection];
                localStorage.setItem('connections', JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleConnectionRemoval = feedId => {
        if (feedId) {
            setConnections(prevConnections => {
                const updated = prevConnections.filter(connection => connection?.feed_id !== feedId);
                localStorage.setItem('connections', JSON.stringify(updated));
                return updated;
            });
        }
    };

    const handleRequestUpdate = (newConnection, senderId) => {
        setConnectRequests(prevRequests =>
            prevRequests.filter(request => request?.sender_id !== senderId)
        );
        dispatch({ 
            type: 'DECREMENT_REQUEST_COUNT',
            count: 1
        });
        if (newConnection) {
            handleConnectionAddition(newConnection);
        }
    };

    const acceptConnection = async (request) => {
        try {
            const response = await api.post('/accept_connect_request', {
                receiverId: viewer?.feed_id,
                senderId: request?.sender_id
            });
            if (response.data?.success) {
                handleRequestUpdate(request.sender, request?.sender_id);
                viewer.connections = (viewer.connections || 0) + 1;
                viewer.connect_requests = (viewer.connect_requests || 1) - 1;
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error accepting request');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const rejectConnection = async (request) => {
        try {
            const response = await api.delete('/delete_connect_request', {
                data: {
                    receiverId: viewer?.feed_id,
                    senderId: request?.sender_id
                }
            });
            if (response.data?.success) {
                handleRequestUpdate(null, request?.sender_id);
                viewer.connect_requests = (viewer.connect_requests || 1) - 1;
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error rejecting request');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const removeConnection = async (connection) => {
        try {
            const response = await api.delete('/delete_connection', {
                data: {
                    deleterId: viewer?.feed_id,
                    feedId: connection?.feed_id
                }
            });
            if (response.data?.success) {
                handleConnectionRemoval(connection?.feed_id);
                viewer.connections = (viewer.connections || 1) - 1;
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error removing connection');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };
 
    const openRemoveModal = (connection) => {
        setConnectionToRemove(connection);
        setIsModalOpen(true);
    };

    const confirmRemoveConnection = async () => {
        if (connectionToRemove) {
            await removeConnection(connectionToRemove);
            setConnectionToRemove(null);
            setIsModalOpen(false);
        }
    };

    const cancelRemoveConnection = () => {
        setConnectionToRemove(null);
        setIsModalOpen(false);
    };

    useEffect(() => {
        const storedConnections = localStorage.getItem('connections');
        if (storedConnections) {
            setConnections(JSON.parse(storedConnections));
        } else {
            loadMoreConnections();
        }
    }, [viewer?.feed_id]);

    useEffect(() => {
        if (connections.length > 0) {
            localStorage.setItem('connections', JSON.stringify(connections));
        } else {
            localStorage.removeItem('connections');
        }
    }, [connections]);

	document.title = 'Messages';
    return (
        <><div className="standard-container">
            <div className="channel-feed">
                <div className="channel-content">
                    <div className="tab-titles">
                        <span className={`tab-title ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')}>
                            {viewer?.connections} {viewer?.connections === 1 ? 'Connection' : 'Connections'}
                        </span>
                        <span className={`tab-title ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
                            {viewer?.connect_requests} {viewer?.connect_requests === 1 ? 'Connect Request' : 'Connect Requests'}
                        </span>
                    </div>
                    <div className="error-message">{errorMessage}</div>
                    {activeTab === 'connections' ? (
                        connections.length === 0 ? (
                            <p className="medium-text faded-text">No connections</p>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full">
                                {connections.map(connection => (
                                    <ConnectionWidget
                                        key={connection?.connection_id}
                                        connection={connection}
                                        onRemove={openRemoveModal}
                                        viewerId={viewer?.feed_id} />
                                ))}
                            </div>
                        )
                    ) : connectRequests.length === 0 ? (
                        <p className="medium-text faded-text">No pending connect requests</p>
                    ) : (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full">
                            {connectRequests.map((request, idx) => (
                                <ConnectionWidget
                                    key={request?.request_id || `request-${idx}`}
                                    connection={request?.sender}
                                    connectRequest={request}
                                    onAccept={acceptConnection}
                                    onReject={rejectConnection}
                                    viewerId={viewer?.feed_id} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
                <nav className="feed-list">
                    <p className="large-text">Messages</p>
                    <p className="small-text faded-text">Coming soon!</p>
                    {/*<ul>
                        {connections.map(c => (
                            <FeedItem key={c.feed_id} feed={c} isChat={true} unreadCount={state.feedCounts?.[c.feed_id] || 0} />
                        ))}
                    </ul>*/}
                </nav>
            </SwipeableAside>
        </div>
        <ConfirmModal
            isOpen={isModalOpen}
            onConfirm={confirmRemoveConnection}
            onCancel={cancelRemoveConnection}
            title="Remove Connection"
            message={`Are you sure you want to remove your connection with ${connectionToRemove?.feed_name}?`} 
        /></>
    );
};

export default MessagesPage;