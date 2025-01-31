import axios from 'axios';
import { FaCommentDots, FaFileUpload, FaMinus, FaPlus, FaPlusCircle } from 'react-icons/fa';
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
import '../css/contentForm.css';
import '../css/feed.css';
import '../css/messages.css';
import { Tooltip } from 'react-tooltip';
import { UnreadContext } from '../components/connections/unreadContext';

const BaseLayout = () => {
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const [currentQuery, setCurrentQuery] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [feeds, setFeeds] = useState([]);
    const [feedName, setFeedName] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState(null);
    const [feedType, setFeedType] = useState('public'); 
    const [feed, setFeed] = useState([]);
    const { setQuery } = useQueryContext();
    const { setTheme } = useContext(ThemeContext);
    const [showForm, setShowForm] = useState(false);
    const { state } = useContext(UnreadContext);
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

    //Fetch feeds that are followed
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
            newFeed.append('viewerFeedId', viewer.feed_id);
            if (feedPhotoFile) {
                newFeed.append('new_feed_photo', feedPhotoFile);
            }
            const response = await axios.post('/api/create_feed', newFeed, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            if (response.data.success === true) {
                const createdFeed = response.data.feed;
                setFeeds((prevFeeds) => [ //Get into correct format
                    ...prevFeeds,
                    {
                        feed_id: createdFeed.feed_id,
                        followedFeed: {
                            feed_name: createdFeed.feed_name,
                            feed_photo: createdFeed.feed_photo,
                        },
                        link_type: 'g',
                    },
                ]);
                setFeedName('');
                setShowForm(false);
                setFeedPhotoFile(null);
                navigate(`/g/${createdFeed.feed_name}`);
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
            setFeedPhotoFile(file);
        }
    };

    //Sends to ask page
    const handleAskClick = async (event) => {
        try {
            event.preventDefault();
            const trimmedQuery = currentQuery.trim();
            const newChatId = v4();
            if (trimmedQuery) {
                if (user.has_membership) {
                    await axios.post('/api/create_ask_chat', {
                        chatId: newChatId,
                        chatName: "New chat"
                    });
                    //Navigate immediately and pass the initial message via state
                    navigate(`/ask/${newChatId}`, { state: { initialMessage: trimmedQuery } });
                }
                setCurrentQuery('');
            } else {
                navigate('/ask/home');
            }
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
                <div className="feed-info main">
                    <Link className="feed-link" to={`/u/${feed.feed_name}`}>
                        <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed" />
                        <p className="feed-list-text">{feed.feed_name}</p>
                    </Link>
                </div>
                <nav id="personal-feeds">
                    <ul>
                        <li className="channel-link"><Link to="/p/recommended">Recommended</Link></li>
                        <li className="channel-link"><Link to="/p/following">Following</Link></li>
                        <li className="channel-link"><Link to="/p/connections">Connections</Link></li>
                    </ul>
                </nav>
                <div id="create-feed-section">
                    <button className="small-icon" title={showForm ? 'Close' : 'Create Feed'} onClick={toggleForm}>
                        {showForm ? (
                            <>
                                <FaMinus />
                            </>
                        ) : (
                            <>
                                <FaPlusCircle />
                            </>
                        )}
                    </button>
                    <Tooltip place="top" effect="solid" delayShow={0}>{showForm ? 'Close' : 'Create feed'}</Tooltip>
                    {showForm && (
                        <form id="create-feed-form" onSubmit={createFeed}>
                            <input className="name-input" type="text" name="Name" placeholder="Feed name..." value={feedName} onChange={(e) => setFeedName(e.target.value)}/>
                            <div className="file-input">
                                <label htmlFor="feed-photo-input" className="small-icon"><FaFileUpload /><p className="icon-text">Choose photo</p></label>
                                <input type="file" id="feed-photo-input" name="Feed photo" onChange={handleFileChange} hidden/>
                                <span className="file-name">{feedPhotoFile ? feedPhotoFile.name : 'No file chosen'}</span>
                            </div>
                            <div className="option-toggle">
                                <button className={feedType === 'public' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setFeedType('public');}}>Public</button>
                                <button className={feedType === 'private' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setFeedType('private');}}>Private</button>
                            </div>
                            <div className="error-message">{errorMessage}</div>
                            <button className="small-icon" title="Create" type="submit" value="Create">
                                <FaPlus />
                            </button>
                        </form>
                    )}
                </div>
                <nav className="feed-list">
                    <ul>
                        {feeds.length === 0 ? (
                            <p>Followed feeds are shown here</p>
                        ) : (
                            feeds.map((feed) => (
                                <FeedItem key={feed.feed_id} feedId={feed.feed_id} isChat={false} linkType={feed.link_type} name={feed.followedFeed.feed_name} photo={feed.followedFeed.feed_photo} />
                            ))
                        )}
                    </ul>
                </nav>
            </aside>
            <main>
                <header id="base-header">
                    <div className="spacer"></div>
                        <form id="search-form" onSubmit={(event) => {
                            event.preventDefault();
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
                <Link id="messages-button" to={`/connections`}>
                    <div className="message-icon-container">
                        <FaCommentDots />
                        {state.total > 0 && (
                            <span className="unread-badge">{state.total}</span>
                        )}
                    </div>
                </Link>
                </header>
                <div className="content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default BaseLayout;
