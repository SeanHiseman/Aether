import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FeedDeletion from './feedDeletion';
import FeedFollowers from './feedFollowers';
import FeedInfoView from './feedInfoView';
import FollowRequests from './followRequests';

const FeedSettings = () => {
    const [currentView, setCurrentView] = useState('profile');
    const [errorMessage, setErrorMessage] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(true);
    const [feed, setFeed] = useState('');
    const { feed_name } = useParams();

    useEffect(() => {
        const fetchFeedData = async () => {
            try {
                const response = await axios.get(`/api/feed/${feed_name}`);
                const feed = response.data.feedResult;
                setFeed({ feed });
                setFeedNotFound(false);
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    setFeedNotFound(true);
                }
            }
        };
        fetchFeedData();
    }, [feed_name]);
    

    const renderComponent = () => {
        switch (currentView) {
            case 'info':
                return <FeedInfoView feed={feed} setFeed={setFeed} />;
            case 'feed-deletion':
                return <FeedDeletion feed={feed} />;
            case 'followers':
                return <FeedFollowers feed={feed} />;
            case 'follow-requests':
                return <FollowRequests feed={feed} />;
            default:
                return null;
        }
    };

    document.title = "Settings";
    return (
        <div className="profile-container">  
            <div className="settings-area">
                {renderComponent()}
            </div>  
            <div id="right-aside">
                <nav id="channel-list">
                    <ul>
                        <Link to={`/g/${feed_name}`}>
                            <h2>{feed_name}</h2>
                        </Link>
                        <div className="error-message">{errorMessage}</div>
                        <li className="settings-item" onClick={() => setCurrentView('info')}>Feed info</li>
                        <li className="settings-item" onClick={() => setCurrentView('followers')}>Followers</li>
                        {feed.type === 'private' && (<li className="settings-item" onClick={() => setCurrentView('follow-requests')}>Follow requests</li>)}
                        {feed.isOwner && (
                            <li 
                                className="settings-item" 
                                onClick={() => setCurrentView('feed-deletion')} 
                                style={{color: 'red'}}
                            >
                                Delete feed
                            </li>
                        )}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default FeedSettings;