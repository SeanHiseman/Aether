import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import FeedItem from '../../components/channels/feedItem';
import ManageConnectionButton from '../../components/connections/manageConnectionButton';

const ConnectionsPage = () => {
    const [activeTab, setActiveTab] = useState('connections');
    const [connections, setConnections] = useState([]);
    const [connectRequests, setConnectRequests] = useState([]); 
    const [errorMessage, setErrorMessage] = useState('');
    const [requestCount, setRequestCount] = useState(0);
    const { viewer } = useContext(AuthContext);

    useEffect(() => {
        const getConnections = async () => {
            try {
                if (viewer.feed_id) {
                    const response = await axios.get(`/api/get_connections/${viewer.feed_id}`);
                    setConnections(response.data);
                }
            } catch (error) {
                setErrorMessage('Error getting connections');
            }
        };

        const getConnectRequests = async () => {
            try {
                if (viewer.feed_id) {
                    const response = await axios.get(`/api/get_connect_requests/${viewer.feed_id}`);
                    const requests = response.data.requests || [];
                    setConnectRequests(requests);
                    setRequestCount(requests.length); 
                }
            } catch (error) {
                setErrorMessage('Error getting connect requests');
            }
        };
        getConnections();
        getConnectRequests();
    }, [viewer.feed_id]);

    const handleConnectionAddition = (newConnection) => {
        if (newConnection) {
            setConnections(prevConnections => [...prevConnections, newConnection]);
        }
    };

    const handleConnectionRemoval = (feedId) => {
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
        setRequestCount(prevCount => prevCount - 1);
        if (newConnection) {
            handleConnectionAddition(newConnection);
        }
    };

    document.title = "Connections";

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
                                                <ManageConnectionButton
                                                    connectRequest={false}
                                                    feed={c}
                                                    isConnected={true}
                                                    viewerId={viewer.feed_id}
                                                    onRequestUpdate={handleConnectionRemoval} />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>                          
                        )
                    ) : (
                        connectRequests.length === 0 ? (
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
                                            <ManageConnectionButton 
                                                connectRequest={request} 
                                                feed={request.sender} 
                                                isConnected={false} 
                                                viewerId={viewer.feed_id} 
                                                onRequestUpdate={handleRequestUpdate} 
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>
            </div>
            <aside id="right-aside">
                <nav className="feed-list">
                    <p className="text36">Messages</p>
                    <ul>
                        {connections.map(c => (
                            <FeedItem 
                                key={c.feed_id} 
                                feedId={c.feed_id} 
                                isChat={true} 
                                linkType={'u'} 
                                name={c.feed_name} 
                                photo={c.feed_photo} 
                            />
                        ))}
                    </ul>
                </nav>
            </aside>
        </div>
    );
};

export default ConnectionsPage;
