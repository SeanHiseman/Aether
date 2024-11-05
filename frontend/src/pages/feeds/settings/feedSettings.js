import { AuthContext } from '../../../components/authContext';
import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ConnectRequests from './connectRequests';
import FeedDeletion from './feedDeletion';
import FeedFollowers from './feedFollowers';
import FeedInfoView from './feedInfoView';
import FollowRequests from './followRequests';
import MembershipSettings from './membershipSettings';
import PasswordPersonal from './passwordPersonal';
import Theme from './theme';

const FeedSettings = () => {
    const [currentView, setCurrentView] = useState('info');
    const [errorMessage, setErrorMessage] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(true);
    const [feed, setFeed] = useState('');
    const { feed_name } = useParams();
    const { user } = useContext(AuthContext);

    useEffect(() => {
        const fetchFeedData = async () => {
            try {
                const response = await axios.get(`/api/feed/${feed_name}`);
                const feed = response.data.feedResult;
                setFeed(feed);
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
            case 'connect-requests':
                return <ConnectRequests feed={feed} />;
            case 'feed-deletion':
                return <FeedDeletion feed={feed} />;
            case 'followers':
                return <FeedFollowers feed={feed} />;
            case 'follow-requests':
                return <FollowRequests feed={feed} />;
            case 'membership-settings':
                return <MembershipSettings feed={feed} />;
            case 'password-personal':
                return <PasswordPersonal feed={feed} />;
            case 'theme':
                return <Theme user={user} />;
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
                        <li className="channel-link" onClick={() => setCurrentView('info')}>Feed info</li>
                        <li className="channel-link" onClick={() => setCurrentView('followers')}>Followers</li>
                        {feed.type === 'private' && (<li className="channel-link" onClick={() => setCurrentView('follow-requests')}>Follow requests</li>)}
                        {!feed.is_group && (<li className="channel-link" onClick={() => setCurrentView('connect-requests')}>Conect requests</li>)}
                        {!feed.is_group && (<li className="channel-link" onClick={() => setCurrentView('membership-settings')}>Membership</li>)}
                        {!feed.is_group && (<li className="channel-link" onClick={() => setCurrentView('password-personal')}>Password</li>)}
                        {!feed.is_group && (<li className="channel-link" onClick={() => setCurrentView('theme')}>Theme</li>)}
                        {feed.isOwner && (
                            <li 
                                className="channel-link" 
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