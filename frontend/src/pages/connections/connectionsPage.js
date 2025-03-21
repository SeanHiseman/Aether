import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FeedItem from '../../components/channels/feedItem';
import ManageConnectionButton from '../../components/connections/manageConnectionButton';
import { AuthContext } from '../../components/authContext';
import { UnreadContext } from '../../components/connections/unreadContext';

const ConnectionsPage = () => {
    const { state, dispatch } = useContext(UnreadContext);
    const { viewer } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('connections');
    const [connections, setConnections] = useState([]);
    const [connectionsOffset, setConnectionsOffset] = useState(0);
    const [connectRequests, setConnectRequests] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [hasMoreConnections, setHasMoreConnections] = useState(true);
    const [hasMoreRequests, setHasMoreRequests] = useState(true);
    const [requestsOffset, setRequestsOffset] = useState(0);

    const loadMoreConnections = async () => {
        try {
            if (viewer.feed_id) {
                const response = await axios.get('/api/get_connections', { params: { feedId: viewer.feed_id, offset: connectionsOffset } });
                const newConnections = response.data;
                if (newConnections.length < 10) {
                    setHasMoreConnections(false);
                }
                setConnections(prevConnections => [...prevConnections, ...newConnections]);
                setConnectionsOffset(prevOffset => prevOffset + newConnections.length);
            }
        } catch (error) {
            setErrorMessage('Error getting connections');
        }
    };

    const loadMoreRequests = async () => {
        try {
            if (viewer.feed_id) {
                const response = await axios.get('/api/get_connect_requests', { params: { feedId: viewer.feed_id, offset: requestsOffset } });
                const newRequests = response.data.requests || [];
                if (newRequests.length < 10) {
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
            setErrorMessage('Error getting connect requests');
        }
    };

    useEffect(() => {
        if (viewer.feed_id) {
            setConnections([]);
            setConnectRequests([]);
            setConnectionsOffset(0);
            setHasMoreConnections(true);
            setRequestsOffset(0);
            setHasMoreRequests(true);
            loadMoreConnections();
            loadMoreRequests();
            const socket = window.socket; 
            if (socket) {
				socket.on('new_connect_request', async () => {
					setRequestsOffset(0);
					setHasMoreRequests(true);
					try {
						const response = await axios.get('/api/get_connect_requests', { 
							params: { feedId: viewer.feed_id, offset: 0 } 
						});
						const newRequests = response.data.requests || [];
						setConnectRequests(newRequests);
						setRequestsOffset(newRequests.length);
						dispatch({ 
							type: 'SET_REQUEST_COUNT',
							count: newRequests.length 
						});
					} catch (error) {
						setErrorMessage('Error getting connect requests');
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
    }, [activeTab, hasMoreConnections, hasMoreRequests, connectionsOffset, requestsOffset, viewer.feed_id]);

    const handleConnectionAddition = newConnection => {
        if (newConnection) {
            setConnections(prevConnections => [...prevConnections, newConnection]);
        }
    };

    const handleConnectionRemoval = feedId => {
        if (feedId) {
            setConnections(prevConnections =>
                prevConnections.filter(connection => connection.feed_id !== feedId)
            );
        }
    };

    const handleRequestUpdate = (newConnection, senderId) => {
        setConnectRequests(prevRequests =>
            prevRequests.filter(request => request.sender_id !== senderId)
        );
        dispatch({ 
            type: 'DECREMENT_REQUEST_COUNT',
            count: 1
        });
        if (newConnection) {
            handleConnectionAddition(newConnection);
        }
    };

    const requestCount = state.requestCount || 0;

	document.title = 'Connections';
	return (
		<div className="standard-container">
			<div className="connections-feed">
				<div className="channel-content">
					<div className="tab-titles">
						<span
							className={`tab-title ${activeTab === 'connections' ? 'active' : ''}`}
							onClick={() => setActiveTab('connections')}
						>
							{connections.length} {connections.length === 1 ? 'Connection' : 'Connections'}
						</span>
						<span
							className={`tab-title ${activeTab === 'requests' ? 'active' : ''}`}
							onClick={() => setActiveTab('requests')}
						>
							{requestCount} {requestCount === 1 ? 'Connect Request' : 'Connect Requests'}
						</span>
					</div>
					<div className="error-message">{errorMessage}</div>
					{activeTab === 'connections' ? (
						connections.length === 0 ? (
							<p>No connections</p>
						) : (
							<ul className="content-list">
								{connections.map(c => (
									<li key={c.connection_id}>
										<div className="result-widget">
											<Link className="feed-link" to={`/u/${c.feed_name}`}>
												<img className="large-feed-photo" src={`/${c.feed_photo}`} alt="Feed" />
												<p className="text36 feed-name">{c.feed_name}</p>
											</Link>
											<div className="remove-connection-box">
												<ManageConnectionButton connectRequest={false} feed={c} isConnected={true} onRequestUpdate={handleConnectionRemoval} viewerId={viewer.feed_id} />
											</div>
										</div>
									</li>
								))}
							</ul>
						)
					) : connectRequests.length === 0 ? (
						<p>No pending connect requests</p>
					) : (
						<ul className="content-list">
							{connectRequests.map((request, index) => (
								<li key={index}>
									<div className="result-widget">
										<Link className="feed-link" to={`/u/${request.sender.feed_name}`}>
											<img className="large-feed-photo" src={`/${request.sender.feed_photo}`} alt="Profile" />
											<p className="text36 feed-name">{request.sender.feed_name}</p>
										</Link>
										<ManageConnectionButton connectRequest={request} feed={request.sender} isConnected={false} onRequestUpdate={handleRequestUpdate} viewerId={viewer.feed_id} />
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
			<aside id="right-aside">
				<nav className="feed-list">
					<p className="text36">Messages</p>
					<ul>
						{connections.map(c => (
							<FeedItem key={c.feed_id} feed={c} isChat={true} unreadCount={state.feedCounts?.[c.feed_id] || 0} />
						))}
					</ul>
				</nav>
			</aside>
		</div>
	);
};

export default ConnectionsPage;
