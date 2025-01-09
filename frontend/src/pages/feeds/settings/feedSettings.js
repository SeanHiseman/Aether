import { AuthContext } from '../../../components/authContext';
import axios from 'axios';
import { FaSignOutAlt } from 'react-icons/fa';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConnectRequests from '../../../components/connections/connectRequests';
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
    const navigate = useNavigate();
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

    const handleLogout = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/logout');
            if (response.data.success) {
                navigate('/login');
            } else {
                setErrorMessage('Logout failed');
            }
        } catch (error) {
            setErrorMessage('Error during logout');
        }
    };

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
                return <MembershipSettings user={user} />;
            case 'password-personal':
                return <PasswordPersonal user={user} />;
            case 'theme':
                return <Theme user={user} />;
            default:
                return null;
        }
    };

    document.title = "Settings";
    return (
        <div className="standard-container">  
            <div className="settings-area">
                {renderComponent()}
            </div>  
            <div id="right-aside">
                <nav id="channel-list">
                    <ul>
                        <Link id="feed-summary" to={`/g/${feed_name}`}>
                            <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                            <p className="text36">{feed_name}</p>
                        </Link>
                        <div className="error-message">{errorMessage}</div>
                        {!feed.is_group &&(<form id="logout-form" action="/api/logout" method="post" onSubmit={handleLogout}>
                            <button className="small-icon" type="submit">
                                <FaSignOutAlt />
                                <p className="icon-text">Logout</p>
                            </button>
                        </form>)}
                        <li className="channel-link" onClick={() => setCurrentView('info')}>Feed info</li>
                        <li className="channel-link" onClick={() => setCurrentView('followers')}>Followers</li>
                        {feed.type === 'private' && feed.isOwner && feed.is_group && (<li className="channel-link" onClick={() => setCurrentView('follow-requests')}>Follow requests</li>)}
                        {!feed.is_group && (<li className="channel-link" onClick={() => setCurrentView('connect-requests')}>Connect requests</li>)}
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