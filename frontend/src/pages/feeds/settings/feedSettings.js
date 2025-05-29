import { AuthContext } from '../../../components/authContext';
import axios from 'axios';
import { FaSignOutAlt } from 'react-icons/fa';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams, Outlet } from 'react-router-dom';

const FeedSettings = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(true);
    const [feed, setFeed] = useState('');
    const { feed_name } = useParams();
    const [followRequests, setFollowRequests] = useState([]);
    const [followRequestCount, setFollowRequestCount] = useState(0);
    const navigate = useNavigate();
    const { rightClasses } = useOutletContext(); 
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

    useEffect(() => {
        const getFollowRequests = async () => {
            try {
                const response = await axios.get(`/api/follow_requests/${feed.feed_id}`);
                const requests = response.data.requests || [];
                setFollowRequests(requests);
                setFollowRequestCount(requests.length);
            } catch (error) {
                setErrorMessage('Error getting requests');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            } 
        };
        if (feed.feed_id) {
            getFollowRequests();
        }
    }, [feed.feed_id]); 

    const handleLogout = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/logout');
            if (response.data.success) {
                navigate('/login');
            } else {
                setErrorMessage('Logout failed');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        } catch (error) {
            setErrorMessage('Logout failed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    document.title = "Settings";
    return (
        <div className="standard-container">  
            <div className="settings-area">
                <Outlet context={{ feed, setFeed, user, followRequests, setFollowRequests, setFollowRequestCount }} />
            </div>  
            <aside className={rightClasses}>
                <nav id="channel-list">
                    <ul>
                        <Link id="feed-summary" to={`/g/${feed_name}`}>
                            <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                            <p className="text36">{feed_name}</p>
                        </Link>
                        <div className="error-message">{errorMessage}</div>
                        {!feed.is_group && (
                            <form id="logout-form" action="/api/logout" method="post" onSubmit={handleLogout}>
                                <button className="small-icon" type="submit">
                                    <FaSignOutAlt />
                                    <p className="icon-text">Logout</p>
                                </button>
                            </form>
                        )}
                        {feed.isAdmin && (
                            <li className="channel-link">
                                <Link to={`/feed_settings/${feed_name}/info`}>Feed info</Link>
                            </li>
                        )}
                        {!feed.is_group && (
                            <li className="channel-link">
                                <Link to={`/feed_settings/${feed_name}/account`}>Account</Link>
                            </li>
                        )}
                        <li className="channel-link">
                            <Link to={`/feed_settings/${feed_name}/followers`}>
                                {feed.follower_count} {feed.follower_count === 1 ? 'Follower' : 'Followers'}
                            </Link>
                        </li>
                        {feed.type === 'private' && feed.is_group && (
                            <li className="channel-link">
                                <Link to={`/feed_settings/${feed_name}/follow_requests`}>
                                    {followRequestCount} {followRequestCount === 1 ? 'Follow request' : 'Follow requests'}
                                </Link>
                            </li>
                        )}
                        {!feed.is_group && (
                            <li className="channel-link">
                                <Link to={`/feed_settings/${feed_name}/membership`}>Membership</Link>
                            </li>
                        )}
                        {!feed.is_group && (
                            <li className="channel-link">
                                <Link to={`/feed_settings/${feed_name}/theme`}>Theme</Link>
                            </li>
                        )}
                        {feed.isOwner && (
                            <li className="channel-link">
                                <Link to={`/feed_settings/${feed_name}/deletion`} style={{color: 'red'}}>
                                    {feed.is_group ? 'Delete feed' : 'Delete account'}
                                </Link>
                            </li>
                        )}
                    </ul>
                </nav>
            </aside>
        </div>
    );
}

export default FeedSettings;