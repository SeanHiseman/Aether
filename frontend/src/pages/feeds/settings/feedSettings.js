import api from '../../../api';
import { applyTheme, DEFAULT_THEME_COLORS, ThemeContext } from '../../../themeProvider';
import { AuthContext } from '../../../components/authContext';
import { FaSignOutAlt } from 'react-icons/fa';
import { FormatNumber } from '../../../functions/formatNumber';
import { Link, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import SwipeableAside from '../../../components/swipeableAside';
import { useContext, useEffect, useState } from 'react';

const FeedSettings = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [feed, setFeed] = useState('');
    const { feed_name } = useParams();
    const [followRequests, setFollowRequests] = useState([]);
    const [followRequestCount, setFollowRequestCount] = useState(0);
    const [isAuthorised, setIsAuthorised] = useState(false);
    const navigate = useNavigate();
    const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 
    const { setTheme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const urlPrefix = feed?.is_group ? 'g' : 'u';

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

    useEffect(() => {
        const fetchFeedData = async () => {
            try {
                const response = await api.get(`/feed/${feed_name}`);
                const feedData = response.data?.feedResult;
                setFeed(feedData);
                if (feedData?.isOwner || feedData?.isAdmin || feedData?.isMod) {
                    setIsAuthorised(true);
                } else {
                    setIsAuthorised(false);
                    navigate(`/${feed?.is_group ? 'g' : 'u'}/${feed_name}`);
                }
            } catch (error) {
                setErrorMessage(error.response?.data?.message || 'Error loading feed data');
            }
        };
        fetchFeedData();
    }, [feed_name, navigate]);

    useEffect(() => {
        const getFollowRequests = async () => {
            try {
                const response = await api.get(`/follow_requests/${feed?.feed_id}`);
                const requests = response.data?.requests || [];
                setFollowRequests(requests);
                setFollowRequestCount(feed?.follow_requests);
            } catch (error) {
                setErrorMessage(error.response?.data?.message || 'Error getting requests');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            } 
        };
        if (feed?.feed_id) {
            getFollowRequests();
        }
    }, [feed?.feed_id]); 

    const handleLogout = async (event) => {
        event.preventDefault();
        try {
            const response = await api.post('/logout');
            if (response.data?.success) {
                localStorage.clear();
                const defaultTheme = DEFAULT_THEME_COLORS.dark;
                setTheme(defaultTheme);
                applyTheme(defaultTheme);
                navigate('/login');
                setTimeout(() => window.location.reload(), 0);
            } else {
                setErrorMessage('Logout failed');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Logout failed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    document.title = "Settings";
    return (
        <div className="standard-container">  
            <div className="settings-area">
                <Outlet context={{ feed, setFeed, user, followRequests, setFollowRequests, setFollowRequestCount, updateFeeds }} />
            </div>  
            <SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
                <nav id="channel-list">
                    <ul>
                        <Link id="feed-summary" to={`/${urlPrefix}/${feed_name}/Main`}>
                            <img className="large-feed-photo" src={`${feed?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                            <p className="large-text bold">{feed_name}</p>
                        </Link>
                        <div className="error-message">{errorMessage}</div>
                        {!feed?.is_group && (
                            <form id="logout-form" action="/api/logout" method="post" onSubmit={handleLogout}>
                                <button className="small-icon" type="submit">
                                    <FaSignOutAlt />
                                    <p className="icon-text">Logout</p>
                                </button>
                            </form>
                        )}
                        {feed?.isAdmin && (
                            <li className="channel-link">
                                <Link to={`/settings/${feed_name}/info`}>Feed info</Link>
                            </li>
                        )}
                        {!feed?.is_group && (
                            <li className="channel-link">
                                <Link to={`/settings/${feed_name}/account`}>Account</Link>
                            </li>
                        )}
                        <li className="channel-link">
                            <Link to={`/settings/${feed_name}/followers`}>
                                {FormatNumber(feed?.follower_count)} {feed?.follower_count === 1 ? 'Follower' : 'Followers'}
                            </Link>
                        </li>
                        {feed?.type === 'private' && (
                            <li className="channel-link">
                                <Link to={`/settings/${feed_name}/follow_requests`}>
                                    {FormatNumber(followRequestCount)} {followRequestCount === 1 ? 'Follow request' : 'Follow requests'}
                                </Link>
                            </li>
                        )}
                        {!feed?.is_group && (
                            <li className="channel-link">
                                <Link to={`/settings/${feed_name}/membership`}>Membership</Link>
                            </li>
                        )}
                        {!feed?.is_group && (
                            <li className="channel-link">
                                <Link to={`/settings/${feed_name}/theme`}>Colour theme</Link>
                            </li>
                        )}
                        {feed?.isOwner && (
                            <li className="channel-link">
                                <Link to={`/settings/${feed_name}/deletion`} style={{color: 'red'}}>
                                    {feed?.is_group ? 'Delete feed' : 'Delete account'}
                                </Link>
                            </li>
                        )}
                    </ul>
                </nav>
            </SwipeableAside>
        </div>
    );
}

export default FeedSettings;