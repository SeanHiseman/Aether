import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { FaCommentDots, FaFileUpload, FaMinus, FaPlus, FaPlusCircle, FaSearch } from 'react-icons/fa';
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
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const [asideErrorMessage, setAsideErrorMessage] = useState('');
    const [currentQuery, setCurrentQuery] = useState('');
    const [deepFeeds, setDeepFeeds] = useState([]);
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
        const fetchDeepFeeds = async () => {
            try {
                const { data } = await axios.get(`/api/deep_feeds/${viewer.feed_id}`);
                console.log("Deep feeds:", data.deepFeeds);
                setDeepFeeds(data.deepFeeds);
            } catch (error) {
                console.error("Error fetching deep feeds:", error);
            }
        };
        if (viewer.feed_id) {
            fetchFeeds();
            fetchDeepFeeds();
        }
    }, [viewer.feed_id, feedsOffset, hasMoreFeeds]);

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
        try {
            event.preventDefault();
            if (!feedName) {
                setAsideErrorMessage('Feed needs a name');
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
                setAsideErrorMessage(error.response.data.message || "Error creating feed"); 
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
        if (!destination) return;
        const sourceDroppableId = source.droppableId;
        const destDroppableId = destination.droppableId;
        const draggedItem = sourceDroppableId.startsWith("deepFeed-")
            ? deepFeeds.find(df => `deep-${df.deep_feed_id}` === result.draggableId)
            : feeds.find(f => `feed-${f.feed_id}` === result.draggableId);
        if (!draggedItem) return;
        //Dropping inside an existing deep feed
        if (destDroppableId.startsWith("deepFeed-")) {
            const targetDeepFeedId = destDroppableId.split("-")[1];
            try {
                const { data } = await axios.post('/api/add_to_deep_feed', {
                    deepFeedId: targetDeepFeedId,
                    feedId: draggedItem.feed_id || null,
                    nestedDeepFeedId: draggedItem.deep_feed_id || null
                });
                if (data.success) {
                    setFeeds(prev => prev.filter(f => f.feed_id !== draggedItem.feed_id));
                    setDeepFeeds(prev => prev.map(df => 
                        df.deep_feed_id === targetDeepFeedId 
                            ? { ...df, feeds: [...df.feeds, draggedItem] } 
                            : df
                    ));
                }
            } catch (error) {
                setAsideErrorMessage("Error adding to deep feed");
            }
        }
        //Creating a new nested deep feed with two dragged feeds
        else if (sourceDroppableId.startsWith("deepFeed-") && destDroppableId.startsWith("deepFeed-") && sourceDroppableId === destDroppableId) {
            const deepFeedName = prompt("New deep feed name:");
            if (!deepFeedName) return;
            try {
                const { data } = await axios.post('/api/create_deep_feed', {
                    viewerId: viewer.feed_id,
                    deepFeedName,
                    feedsToInclude: [draggedItem.feed_id].filter(Boolean)
                });
                if (data.success) {
                    setDeepFeeds(prev => [
                        ...prev.filter(df => df.deep_feed_id !== draggedItem.deep_feed_id),
                        data.deepFeed
                    ]);
                }
            } catch (error) {
                setAsideErrorMessage("Error creating deep feed");
            }
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
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="left-aside-feed-info">
                        <Link className="feed-link" to={`/u/${feed.feed_name}`}>
                            <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed" />
                            <p className="feed-list-text">{feed.feed_name}</p>
                        </Link>
                        <Link id="messages-button" to={`/connections`}>
                            <div className="message-icon-container">
                                <FaCommentDots title="Messages and connections" />
                                {state.total > 0 && (
                                    <span className="unread-badge">{state.total}</span>
                                )}
                            </div>
                        </Link>
                    </div>
                    <nav id="personal-feeds">
                        <ul>
                            <li className="channel-link"><Link to="/p/recommended">Recommended</Link></li>
                            <li className="channel-link"><Link to="/p/following">Following</Link></li>
                            <li className="channel-link"><Link to="/p/connection_posts">Connections</Link></li>
                            <Droppable droppableId="deepFeedList">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {deepFeeds.map((deepFeed, index) => (
                                            <Draggable key={deepFeed.deep_feed_id} draggableId={`deep-${deepFeed.deep_feed_id}`} index={index}>
                                                {(provided) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                        <DeepFeedItem deepFeed={deepFeed} />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </ul>
                    </nav>
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
                                        <FaFileUpload /><p className="icon-text">Choose photo</p>
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
                        <Droppable droppableId="feedList">
                            {(provided) => (
                                <ul {...provided.droppableProps} ref={provided.innerRef}>
                                    {feeds.length === 0 ? (
                                        <p>Followed feeds are shown here</p>
                                    ) : (
                                        feeds.map((feed, index) => (
                                            <Draggable key={feed.feed_id} draggableId={feed.feed_id.toString()} index={index}>
                                                {(provided) => (
                                                    <li ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                        <FeedItem
                                                            feed={feed.followedFeed}
                                                            isChat={false}
                                                        />
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