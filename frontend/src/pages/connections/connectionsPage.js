import React, { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import FeedItem from '../../components/channels/feedItem';
import ManageConnectionButton from '../../components/manageConnectionButton';

const ConnectionsPage = () => {
    const [connections, setConnections] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
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
        getConnections();
    }, [viewer.feed_id]);

    const handleConnectionRemoval = (feedId) => {
        setConnections((prevConnections) => 
            prevConnections.filter((connection) => connection.feed_id !== feedId)
        );
    };

    document.title = "Connections";
    return (
        <div className="standard-container">
            <div className="connections-feed">
                <div className="channel-content">
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <ul className="content-list">
                        {connections.map(c => (
                            <li key={c.connection_id}>
                                <div className="result-widget">
                                    <Link className="feed-link" to={`/u/${c.feed_name}`}>
                                        <img className="large-feed-photo" src={`/${c.feed_photo}`} alt="Feed" />
                                        <p className="text36 feed-name">{c.feed_name}</p>
                                    </Link>
                                    <div className="remove-connection-box">
                                        <ManageConnectionButton connectRequest={false} feed={c} isConnected={true} viewerId={viewer.feed_id} onRequestUpdate={handleConnectionRemoval} />
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <aside id="right-aside">
                <nav className="feed-list">
                    <p className="text36">Messages</p>
                    <ul>
                        {connections.map(c => (
                            <FeedItem key={c.feed_id} feedId={c.feed_id} isChat={true} linkType={'u'} name={c.feed_name} photo={c.feed_photo} />
                        ))}
                    </ul>
                </nav> 
            </aside>
        </div>
    );
};

export default ConnectionsPage;
