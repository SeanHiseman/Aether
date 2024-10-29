import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import FeedItem from '../components/channels/feedItem';
import { ThemeContext } from '../themeProvider';
import { useQueryContext } from '../components/search/queryContext';
import '../css/baseLayout.css';
import '../css/basicStyles.css';
import '../css/contentFeed.css';
import '../css/groups.css';
import '../css/messages.css';
import '../css/profile.css';
import '../css/replies.css';

const BaseLayout = () => {
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const [currentQuery, setCurrentQuery] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [feeds, setFeeds] = useState([]);
    const [feedName, setFeedName] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState('No file chosen');
    const [feedType, setFeedType] = useState('public'); 
    const [feed, setFeed] = useState([]);
    const { setQuery } = useQueryContext();
    const { setTheme } = useContext(ThemeContext);
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchViewerFeed = async () => {
            if (isAuthenticated && viewer) {
                try {
                    const response = await axios.get(`/api/feed/${viewer.feed_name}`);
                    const feed = response.data.feedResult;
                    setFeed(feed);
                    const themeResponse = await axios.get('/api/get_theme');
                    setTheme(themeResponse.data.theme);
                } catch (error) {
                    if (error.response && error.response.status === 401) {
                        navigate('/login');
                    }
                }
            }
        };
        fetchViewerFeed();
    }, [isAuthenticated, viewer, navigate, setTheme]);

    //Fetch feeds that a user follows
    useEffect(() => {
        const fetchFeeds = async () => {
            try {
                const response = await axios.get(`/api/feed_list/${viewer.feed_id}`);
                setFeeds(response.data);
            } catch (error) {
                setFeeds([]);
            }
        };
        //Only called when feed has loaded
        if (viewer.feed_id) {
            fetchFeeds();
        }
    }, [viewer.feed_id]);

    const createFeed = async (event) => {
        try {
            event.preventDefault();
            if (!feedName) {
                setErrorMessage('Feed needs a name');
                return;
            } 
            const newFeed = new FormData();
            newFeed.append('feedName', feedName);
            newFeed.append('type', feedType);
            newFeed.append('isGroup', true);
            newFeed.append('feedOwner', user.user_id);
            newFeed.append('creator', viewer);
            const response = await axios.post('/api/create_feed', newFeed);
            if (response.data.success === true) {
                const createdFeed = response.data.feed;
                setFeeds([...feeds, createdFeed]);
                navigate(`/g/${createdFeed.feed_name}`);
                setFeedName('');
                setShowForm(false);
            }
        } catch (error) {
            if (error.response.status === 413) {
                setErrorMessage("File cannot be more than 5MB");
            } else if (error.response.status === 400 ) {
                setErrorMessage("Name taken");
            } else {
                setErrorMessage("Error creating feed"); 
            }
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setFeedPhotoFile(file.name);
        }
    };

    //Sends to ask page
    const handleAskClick = async (event) => {
        try {
            event.preventDefault();
            //Check if input bar is empty
            if (!currentQuery.trim()) {
                navigate('/ask/home');
                return;
            }
            const newChatId = v4();
            if (viewer.hasMembership) {
                await axios.post('/api/create_ask_chat', {
                    chatId: newChatId,
                    name: "New chat"
                });
            };
            setQuery(currentQuery);
            setCurrentQuery('');
            navigate(`/ask/${newChatId}`);
        } catch (error) {
            setErrorMessage("Error sending Ask");
        }
    };

    //Sends to search page
    const handleSearchClick = (event) => {
        event.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };

    //Toggles display of create feed form after button is pressed
    const toggleForm = () => { 
        if (showForm) {
            setErrorMessage('');
            setFeedName('');
            setFeedPhotoFile('No file chosen');
        };
        setShowForm(!showForm) 
    }

    return (
        <div className="container">
            <aside id="left-aside">
                <div className="profile-info">
                    <Link className="profile-link" to={`/u/${feed.feed_name}`}>
                        <img className="profile-image" src={`/${feed.feed_photo}`} alt="Profile" />
                        <p id="logged-in-username">{feed.feed_name}</p>
                    </Link>
                </div>
                <nav id="personal-feeds">
                    <ul>
                        <li className="feed-link"><Link to="/p/recommended">Recommended</Link></li>
                        <li className="feed-link"><Link to="/p/following">Following</Link></li>
                        <li className="feed-link"><Link to="/p/friends">Friends</Link></li>
                    </ul>
                </nav>
                <div id="create-group-section">
                    <button className="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create feed'}
                    </button>
                    {showForm && (
                        <form id="create-group-form" onSubmit={createFeed}>
                            <input className="name-input" type="text" name="Name" placeholder="Feed name..." value={feedName} onChange={(e) => setFeedName(e.target.value)}/>
                            <div className="file-input">
                                <label htmlFor="group-photo-input" class="dark-button">Choose photo</label>
                                <input type="file" id="group-photo-input" name="Group photo" onChange={handleFileChange} hidden/>
                                <span className="file-name">{feedPhotoFile}</span>
                            </div>
                            <div className="option-toggle">
                                <button className={feedType === 'public' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setFeedType('public');}}>Public</button>
                                <button className={feedType === 'private' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setFeedType('private');}}>Private</button>
                            </div>
                            <div className="error-message">{errorMessage}</div>
                            <input className="dark-button" type="submit" value="Create" />
                        </form>
                    )}
                </div>
                <nav className="feed-list">
                    <ul>
                        {feeds.length === 0 ? (
                            <p>Followed feeds are shown here</p>
                        ) : (
                            feeds.map((feed) => (
                                <FeedItem key={feed.feed_id} feedId={feed.feed_id} name={feed.followed.feed_name} photo={feed.followed.feed_photo} linkType={feed.link_type} link={`/${feed.link_type}/${feed.followed.feed_name}/Main`} />
                            ))
                        )}
                    </ul>
                </nav>
            </aside>
            <main>
                <header id="base-header">
                    <div className="spacer"></div>
                        <form id="search-form" onSubmit={(e) => {
                            e.preventDefault();
                            handleSearchClick();
                        }}>
                            <div className="search-container">
                                <button className="icon-button ask" data-tooltip="Ask" type="button" onClick={handleAskClick}>
                                    <img className="standard-icon" src="/media/site_images/icons/ask.png" alt="Ask"/>
                                </button>
                                <input id="search-bar" type="text" name="keyword" placeholder="Type..." value={currentQuery} onChange={(e) => setCurrentQuery(e.target.value)}/>
                                <button className="icon-button search" data-tooltip="Search" type="submit" onClick={handleSearchClick}>
                                    <img className="standard-icon" src="/media/site_images/icons/search.png" alt="Search"/>
                                </button>
                            </div>
                        </form>
                <div className="spacer"></div>
                <Link id="messages-button" to={`/messages`}>Messages</Link>
                </header>
                <div className="content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default BaseLayout;
