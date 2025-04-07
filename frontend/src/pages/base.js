import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { FaArrowRight, FaFileUpload, FaMinus, FaPlus, FaPlusCircle, FaSearch, FaSignInAlt } from 'react-icons/fa';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import DeepFeedItem from '../components/channels/deepFeedItem';
import FeedItem from '../components/channels/feedItem';
import { ThemeContext } from '../themeProvider';
import { Tooltip } from 'react-tooltip';
import { UnreadContext } from '../components/connections/unreadContext';
import '../css/baseLayout.css';
import '../css/basicStyles.css';
import '../css/contentFeed.css';
import '../css/contentForm.css';
import '../css/feed.css';
import '../css/messages.css';

const BaseLayout = () => {
    console.log("BaseLayout rendered");
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const [asideErrorMessage, setAsideErrorMessage] = useState('');
    const [currentQuery, setCurrentQuery] = useState('');
    const [deepFeeds, setDeepFeeds] = useState([]);
    const [deepFeedRefs, setDeepFeedRefs] = useState({});
    const [feeds, setFeeds] = useState([]);
    const [feedsOffset, setFeedsOffset] = useState(0);
    const [feedName, setFeedName] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState(null);
    const [feedType, setFeedType] = useState('public'); 
    const [feed, setFeed] = useState([]);
    const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
    const [headerErrorMessage, setHeaderErrorMessage] = useState('');
    const { setTheme } = useContext(ThemeContext);
    const [showForm, setShowForm] = useState(false);
    const { state } = useContext(UnreadContext);
    const feedContainerRef = useRef(null);
    const navigate = useNavigate();
    const hasMembership = user?.has_membership;
	const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024;

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
        if (!isAuthenticated || !viewer?.feed_id) return;
        const fetchFeeds = async () => {
            if (!hasMoreFeeds) return; //Stop fetching if no more feeds
            try {
                //Request 30 feeds at a time using offset and limit
                const response = await axios.get('/api/feed_list', {
                    params: { followerId: viewer.feed_id, offset: feedsOffset, limit: 30 }
                });
                let newFeeds = response.data.formattedFeeds;
                if (newFeeds.length < 30) {
                    setHasMoreFeeds(false);
                }
                //Normalize each feed so there always is a followedFeed object.
                const normalizedFeeds = newFeeds.map(feed => {
                    //If the API already sends a nested followedFeed, use it.
                    if (feed.followedFeed) {
                        return feed;
                    }
                    //Otherwise, create it from the top-level properties.
                    return {
                        feed_id: feed.feed_id,
                        followedFeed: {
                            feed_name: feed.feed_name,
                            feed_photo: feed.feed_photo,
                        },
                        link_type: feed.link_type,
                    };
                });
                setFeeds(prevFeeds => [...prevFeeds, ...normalizedFeeds]);
            } catch (error) {
                setFeeds([]);
            }
        };
        fetchFeeds();
    }, [feedsOffset, hasMoreFeeds, isAuthenticated, viewer?.feed_id]);

    useEffect(() => {
        if (!isAuthenticated || !viewer?.feed_id) return;
        const fetchDeepFeeds = async () => {
            try {
                const response = await axios.get(`/api/deep_feeds/${viewer.feed_id}`);
                setDeepFeeds(response.data.deepFeeds);
            } catch (error) {
                setDeepFeeds([]);
                setAsideErrorMessage("Error fetching deep feeds");
            }
        };
        fetchDeepFeeds();
    }, [isAuthenticated, viewer?.feed_id]);

    useEffect(() => {
        const handleScroll = () => {
            if (!feedContainerRef.current || !hasMoreFeeds) return;
            const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
            if (scrollHeight - scrollTop <= clientHeight + 50) { //Load more when near bottom
                //Increase offset by 30 to load the next page.
                setFeedsOffset(prevOffset => prevOffset + 30);
            }
        };
        const container = feedContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, [hasMoreFeeds]);

    const createFeed = async (event) => {
        if (!isAuthenticated) return;
        try {
            event.preventDefault();
            if (!feedName) {
                setAsideErrorMessage("Feed needs a name");
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
                setFeeds((prevFeeds) => [ //Format the new feed to match the expected structure
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
            if (error.response && error.response.status === 413) {
                setAsideErrorMessage(error.response.data.message + (!user.has_membership ? ". Get membership for more" : ""));
            } else if (error.response.status === 400 ) {
                setAsideErrorMessage("Name taken");
            } else {
                setAsideErrorMessage("Error creating feed"); 
            }
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                setAsideErrorMessage(hasMembership ? 
                    `File exceeds your max size limit of 100MB.` : 
                    `File exceeds your max size limit of 1MB. Get membership for more.`);
                return;
            }
            setFeedPhotoFile(file);
            setAsideErrorMessage('');
        }
    };

    const handleAskClick = async (event) => {
        event.preventDefault(); 
        if (!isAuthenticated) {
            const willLogin = window.confirm('Please log in to continue');
            if (willLogin) {
                navigate('/login', { state: { from: window.location.pathname } });
            }
            return; 
        }
        try {
            const trimmedQuery = currentQuery.trim();
            const newChatId = v4();
            if (trimmedQuery) {
                if (user.has_membership) {
                    await axios.post('/api/create_ask_chat', {
                        chatId: newChatId,
                        chatName: "New chat"
                    });
                    navigate(`/ask/${newChatId}`, { state: { initialMessage: trimmedQuery } });
                }
                setCurrentQuery('');
            } else {
                navigate('/ask/home');
            }
        } catch (error) {
            setHeaderErrorMessage("Error sending Ask");
        }
    };

    const handleSearchClick = (event) => {
        event.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };

    const onDragEnd = async (result) => {
        const { source, destination } = result;
        //No valid destination or same position
        if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
            return;
        }
        try {
            //Creating a new deep feed by dragging feeds together
            if (source.droppableId === "feedList" && destination.droppableId === "feedList") {
                const sourceFeed = feeds[source.index];
                const destinationFeed = feeds[destination.index];
                const deepFeedName = prompt("Create a new deep feed by combining these feeds. Enter a name:");
                if (deepFeedName) {
                    const { data } = await axios.post("/api/create_deep_feed", {
                        viewerId: viewer.feed_id,
                        deepFeedName,
                        feedsToInclude: [sourceFeed.feed_id, destinationFeed.feed_id]
                    });
                    if (data.success && data.deepFeed) {
                        setDeepFeeds(prevDeepFeeds => [
                            ...prevDeepFeeds,
                            {
                                ...data.deepFeed,
                                feeds: data.feedsToInclude.map(feedId => ({
                                    feed: feeds.find(f => f.feed_id === feedId) //Match existing feed objects
                                }))
                            }
                        ]);
                    }                   
                }
                return;
            }
            //Dragging a feed into a deep feed
            if (source.droppableId === "feedList" && destination.droppableId.startsWith("deep-feed-")) {
                const sourceFeed = feeds[source.index];
                const destinationDeepFeedId = destination.droppableId.replace("deep-feed-", "");
                try {
                    const { data } = await axios.post("/api/add_to_deep_feed", {
                        deepFeedId: destinationDeepFeedId,
                        feedId: sourceFeed.feed_id,
                        nestedDeepFeedId: null
                    });
                    if (data.success) {
                        //Trigger the update in the specific DeepFeedItem
                        if (deepFeedRefs[destinationDeepFeedId]) {
                            console.log('Calling ref handler for:', destinationDeepFeedId);
                            deepFeedRefs[destinationDeepFeedId](sourceFeed);
                        } else {
                            console.log('No ref found for:', destinationDeepFeedId);
                        }
                    }
                } catch (error) {
                    setAsideErrorMessage("Error adding feed to deep feed:", error);
                }
                return;
            }
            //Dragging a deep feed into another deep feed
            const sourceDeepFeedId = deepFeeds[source.index]?.deep_feed_id;
            const destinationDeepFeedId = destination.droppableId.startsWith("deep-feed-")
                ? destination.droppableId.replace("deep-feed-", "")
                : null;
            if (source.droppableId === "deepFeedsList" && destinationDeepFeedId) {
                const { data } = await axios.post("/api/add_to_deep_feed", {
                    deepFeedId: destinationDeepFeedId,
                    feedId: null,
                    nestedDeepFeedId: sourceDeepFeedId
                });
                if (data.success) {
                    setDeepFeeds(prevDeepFeeds =>
                        prevDeepFeeds.map(deepFeed =>
                            deepFeed.deep_feed_id === destinationDeepFeedId
                                ? {
                                    ...deepFeed,
                                    feeds: [...deepFeed.feeds, { nestedDeepFeed: deepFeeds.find(df => df.deep_feed_id === sourceDeepFeedId) }]
                                }
                                : deepFeed
                        )
                    );
                }
                return;
            }
        } catch (error) {
            setAsideErrorMessage("Drag and drop error");
        }
    };

    const toggleForm = () => { 
        if (showForm) {
            setFeedName('');
            setFeedPhotoFile('No file chosen');
        };
        setShowForm(!showForm);
        setAsideErrorMessage('');
    };

    return (
        <div className="container">
            <aside id="left-aside" ref={feedContainerRef}>
                <div className="left-aside-feed-info">
                    {isAuthenticated && (
                        <Link className="feed-link" to={`/u/${feed.feed_name}`}>
                            <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed" />
                            <p className="feed-list-text">{feed.feed_name}</p>
                        </Link>
                    )}
                    {/*<Link id="messages-button" to={`/connections`}>
                        <div className="message-icon-container">
                            <FaCommentDots title="Messages and connections" />
                            {state.total > 0 && (
                                <span className="unread-badge">{state.total}</span>
                            )}
                        </div>
                    </Link>*/}
                </div>
                {isAuthenticated ? (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <nav id="personal-feeds">
                            <ul>
                                <li className="channel-link"><Link to="/p/recommended">Recommended</Link></li>
                                <li className="channel-link"><Link to="/p/following">Following</Link></li>
                                <li className="channel-link"><Link to="/p/connection_posts">Connections</Link></li>
                            </ul>
                        </nav>
                        <Droppable droppableId="deepFeedsList" type="deepFeed">
                            {(provided) => (
                                <div className="deep-feeds-container" {...provided.droppableProps} ref={provided.innerRef}>
                                    {deepFeeds.map((deepFeed, index) => (
                                        <DeepFeedItem key={deepFeed.deep_feed_id} deepFeed={deepFeed} index={index} />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                        <div className="error-message">{asideErrorMessage}</div>
                        <div id="create-feed-section">
                            <button className="small-icon" onClick={toggleForm} style={{alignSelf: 'flex-start', marginLeft: 'calc(5% + 10px)'}}>
                                {showForm ? (
                                    <>
                                        <FaMinus /> 
                                        <p className="icon-text">Close</p>
                                    </>
                                ) : (
                                    <>
                                        <FaPlusCircle />
                                        <p className="icon-text">Create Feed</p>
                                    </>
                                )}
                            </button>
                            <Tooltip place="top" effect="solid" delayShow={0}>
                                {showForm ? 'Close' : 'Create feed'}
                            </Tooltip>
                            {showForm && (
                                <form id="create-feed-form" onSubmit={createFeed}>
                                    <input 
                                        className="name-input" 
                                        type="text" 
                                        name="Name" 
                                        placeholder="Feed name..." 
                                        value={feedName} 
                                        onChange={(e) => {
                                            e.preventDefault();
                                            const input = e.target.value;
                                            if (input.length <= 30) {
                                                setFeedName(input);
                                                setAsideErrorMessage('');
                                            } else {
                                                setAsideErrorMessage("Name too long");
                                            }
                                        }}
                                    />
                                    <div className="file-input">
                                        <label htmlFor="feed-photo-input" className="small-icon">
                                            <FaFileUpload /><p className="icon-text">Choose feed photo</p>
                                        </label>
                                        <input type="file" id="feed-photo-input" name="Feed photo" onChange={handleFileChange} hidden/>
                                        <span className="file-name">{feedPhotoFile ? feedPhotoFile.name : 'No file chosen'}</span>
                                    </div>
                                    <div className="option-toggle">
                                        <button className={feedType === 'public' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setFeedType('public');}} title="Visible to everyone">
                                            Public
                                        </button>
                                        <button className={feedType === 'private' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setFeedType('private');}} title="Requires permission to follow">
                                            Private
                                        </button>
                                    </div>
                                    <button className={feedName.length === 0 ? "small-icon disabled" : "small-icon"} disabled={feedName.length === 0} title={feedName.length === 0 ? "Enter a name" : "Create"} type="submit" value="Create">
                                        <FaPlus />
                                    </button>
                                </form>
                            )}
                        </div>
                        <nav className="feed-list">
                            <Droppable droppableId="feedList" type="feed">
                                {(provided) => (
                                    <ul {...provided.droppableProps} ref={provided.innerRef} className="feeds-list">
                                        {feeds.length === 0 ? (
                                            <p>Followed feeds are shown here</p>
                                        ) : (
                                            feeds.map((feed, index) => (
                                                <Draggable key={feed.feed_id} draggableId={feed.feed_id.toString()} index={index}>
                                                    {(provided) => (
                                                        <li ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                            <FeedItem feed={feed.followedFeed} isChat={false} />
                                                        </li>
                                                    )}
                                                </Draggable>
                                            ))
                                        )}
                                        {provided.placeholder}
                                    </ul>
                                )}
                            </Droppable>
                        </nav>
                    </DragDropContext>
                ) : (
                    <div>
                        <Link to="/login" className="large-icon">
                            <FaSignInAlt />
                            <p className="icon-text">Login</p>
                        </Link>
                        <Link to="/join" className="large-icon">
                            <FaArrowRight />
                            <p className="icon-text">Join</p>
                        </Link>
                        <p style={{marginTop: '20px'}}>Sign up or log in for more</p>
                    </div>
                )}
            </aside>
            <main>
                <header id="base-header">
                    <div className="spacer"></div>
                    <form id="search-form" onSubmit={handleSearchClick}>
                        <div className="search-container">
                            <button className="icon-button ask" data-tooltip="Ask" type="button" onClick={handleAskClick}>
                                <img className="standard-icon" src="/media/site_images/icons/ask.png" alt="Ask"/>
                            </button>
                            <input 
                                id="search-bar" 
                                type="text" 
                                name="keyword" 
                                placeholder="Search or Ask..." 
                                value={currentQuery} 
                                onChange={(e) => {
                                    const input = e.target.value;
                                    if (input.length <= 1000) {
                                        setCurrentQuery(input);
                                        setHeaderErrorMessage('');
                                    } else {
                                        setHeaderErrorMessage("Query too long");
                                    }
                                }}
                            />
                            <button className="icon-button search" data-tooltip="Search" type="submit">
                                <FaSearch className="standard-icon" />
                            </button>
                        </div>
                    </form>
                    <div className="spacer">
                        <div className="error-message">{headerErrorMessage}</div>
                    </div>
                </header>
                <div className="content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default BaseLayout;