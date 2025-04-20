import axios from 'axios';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FaArrowRight, FaFileUpload, FaMinus, FaPlus, FaPlusCircle, FaSearch, FaSignInAlt } from 'react-icons/fa';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
    const [deepFeedCallbacks, setDeepFeedCallbacks] = useState({});
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
    const [activeId, setActiveId] = useState(null);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [dragType, setDragType] = useState(null);
    
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event) => {
        const { active } = event;
        const activeId = active.id;
        let dragType = 'feed';
        let dragItem = null;
        if (typeof activeId === 'string' && activeId.startsWith('df-')) {
            dragType = 'deepFeed';
            const deepFeedId = activeId.replace('df-', '');
            dragItem = deepFeeds.find(df => df.deep_feed_id === deepFeedId);
        } else if (typeof activeId === 'string' && activeId.startsWith('df-item-')) {
            //Feed inside a deep feed
            dragType = 'feedInDeepFeed';
            const feedId = activeId.replace('df-item-', '');
            //Find which deep feed contains this feed
            for (const deepFeed of deepFeeds) {
                const content = deepFeed.feeds?.find(item => 
                    item.feed && item.feed.feed_id === feedId
                );
                if (content) {
                    dragItem = {
                        feed: content.feed,
                        parentDeepFeedId: deepFeed.deep_feed_id
                    };
                    break;
                }
            }
        } else {
            dragType = 'feed';
            dragItem = feeds.find(feed => feed.feed_id.toString() === activeId);
        }
        setDragType(dragType);
        setActiveDragItem(dragItem);
        setActiveId(activeId);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over) {
            //If it's a feedInDeepFeed being dragged out with no destination
            if (dragType === 'feedInDeepFeed') {
                try {
                    const sourceParentDeepFeedId = activeDragItem.parentDeepFeedId;
                    const sourceFeedId = activeDragItem.feed.feed_id;
                    
                    const { data } = await axios.post("/api/remove_from_deep_feed", {
                        deepFeedId: sourceParentDeepFeedId,
                        feedId: sourceFeedId
                    });
                    
                    if (data.success && deepFeedCallbacks[sourceParentDeepFeedId]) {
                        deepFeedCallbacks[sourceParentDeepFeedId]({ type: 'UPDATE_CONTENTS' });
                    }
                } catch (error) {
                    setAsideErrorMessage("Error removing from Deep Feed");
                }
            } else if (dragType === 'nestedDeepFeed') {
                try {
                    const sourceParentDeepFeedId = activeDragItem.parentDeepFeedId;
                    const nestedDeepFeedId = activeDragItem.nestedDeepFeed.deep_feed_id;
                    
                    const { data } = await axios.post("/api/remove_from_deep_feed", {
                        deepFeedId: sourceParentDeepFeedId,
                        nestedDeepFeedId: nestedDeepFeedId
                    });
                    
                    if (data.success && deepFeedCallbacks[sourceParentDeepFeedId]) {
                        deepFeedCallbacks[sourceParentDeepFeedId]({ type: 'UPDATE_CONTENTS' });
                    }
                } catch (error) {
                    setAsideErrorMessage("Error removing nested deep feed");
                }
            }
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        const activeId = active.id;
        const overId = over.id;
        if (activeId === overId) {
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        try {
            //Creating a new deep feed by dragging feeds together in feed list
            if (dragType === 'feed' && typeof overId === 'string' && !overId.startsWith('df-') && !overId.startsWith('df-item-')) {
                const sourceFeed = feeds.find(feed => feed.feed_id.toString() === activeId);
                const destinationFeed = feeds.find(feed => feed.feed_id.toString() === overId);
                if (sourceFeed && destinationFeed) {
                    const deepFeedName = prompt("Enter Deep Feed name:");
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
                                        feed: feeds.find(f => f.feed_id === feedId)
                                    }))
                                }
                            ]);
                        }                   
                    }
                }
            }
            //Dragging a feed into a deep feed
            else if (dragType === 'feed' && typeof overId === 'string' && overId.startsWith('df-')) {
                const sourceFeed = feeds.find(feed => feed.feed_id.toString() === activeId);
                const destinationDeepFeedId = overId.replace('df-', '');
                if (sourceFeed) {
                    try {
                        const { data } = await axios.post("/api/add_to_deep_feed", {
                            deepFeedId: destinationDeepFeedId,
                            feedId: sourceFeed.feed_id,
                            nestedDeepFeedId: null
                        });
                        if (data.success) {
                            if (deepFeedCallbacks[destinationDeepFeedId]) {
                                deepFeedCallbacks[destinationDeepFeedId](sourceFeed);
                            } else {
                                setAsideErrorMessage("Error updating Deep Feed");
                            }
                        }
                    } catch (error) {
                        setAsideErrorMessage("Error updating Deep Feed");
                    }
                }
            }
            //Dragging a deep feed into another deep feed
            else if (dragType === 'deepFeed' && typeof overId === 'string' && overId.startsWith('df-')) {
                const sourceDeepFeedId = activeId.replace('df-', '');
                const destinationDeepFeedId = overId.replace('df-', '');
                const sourceDeepFeed = deepFeeds.find(df => df.deep_feed_id === sourceDeepFeedId);
                //Don't allow dropping a deep feed onto itself
                if (!sourceDeepFeed || sourceDeepFeedId === destinationDeepFeedId) {
                    setActiveId(null);
                    setActiveDragItem(null);
                    setDragType(null);
                    return;
                }
                try {
                    const { data } = await axios.post("/api/add_to_deep_feed", {
                        deepFeedId: destinationDeepFeedId,
                        feedId: null,
                        nestedDeepFeedId: sourceDeepFeedId
                    });
                    
                    if (data.success) {
                        //Remove the source deep feed from the top level since it's now nested
                        setDeepFeeds(prevDeepFeeds => 
                            prevDeepFeeds.filter(df => df.deep_feed_id !== sourceDeepFeedId)
                        );
                        if (deepFeedCallbacks[destinationDeepFeedId]) {
                            deepFeedCallbacks[destinationDeepFeedId]({
                                type: 'ADD_NESTED_DEEP_FEED',
                                nestedDeepFeed: sourceDeepFeed
                            });
                        }
                    } else {
                        setAsideErrorMessage(data.message || "Error adding deep feed");
                    }
                } catch (error) {
                    setAsideErrorMessage("Error adding deep feed");
                }
            }
            //Creating a nested deep feed by dragging feeds within a deep feed
            else if ((dragType === 'feedInDeepFeed' && typeof overId === 'string' && overId.startsWith('df-item-')) ||
                    (dragType === 'feed' && typeof overId === 'string' && overId.startsWith('df-item-'))) {
                let sourceParentDeepFeedId, sourceFeedId, destFeedId;
                let sourceFeedItem, destFeedItem;
                if (dragType === 'feedInDeepFeed') {
                    sourceParentDeepFeedId = activeDragItem.parentDeepFeedId;
                    sourceFeedId = activeDragItem.feed.feed_id;
                    sourceFeedItem = activeDragItem.feed;
                } else {
                    sourceFeedId = activeId;
                    sourceFeedItem = feeds.find(feed => feed.feed_id.toString() === activeId)?.followedFeed;
                }
                destFeedId = overId.replace('df-item-', '');
                //Find which deep feed contains the destination feed
                let destParentDeepFeedId;
                for (const deepFeed of deepFeeds) {
                    const content = deepFeed.feeds?.find(item => 
                        item.feed && item.feed.feed_id === destFeedId
                    );
                    if (content) {
                        destParentDeepFeedId = deepFeed.deep_feed_id;
                        destFeedItem = content.feed;
                        break;
                    }
                }
                if (sourceFeedItem && destFeedItem) {
                    //If both feeds are in the same deep feed, create a nested deep feed
                    if (dragType === 'feedInDeepFeed' && sourceParentDeepFeedId === destParentDeepFeedId) {
                        const deepFeedName = prompt("Enter Deep Feed name:");
                        if (deepFeedName) {
                            try {
                                const { data } = await axios.post("/api/create_deep_feed", {
                                    viewerId: viewer.feed_id,
                                    deepFeedName,
                                    feedsToInclude: [sourceFeedId, destFeedId],
                                    parentDeepFeedId: destParentDeepFeedId
                                });
                                if (data.success && data.deepFeed) {
                                    setDeepFeeds(prevDeepFeeds => 
                                        prevDeepFeeds.map(df => {
                                            if (df.deep_feed_id === destParentDeepFeedId) {
                                                const currentFeeds = [...df.feeds];
                                                //Remove the two feeds that were combined
                                                const filteredFeeds = currentFeeds.filter(item => 
                                                    !(item.feed && (item.feed.feed_id === sourceFeedId || item.feed.feed_id === destFeedId))
                                                );
                                                filteredFeeds.push({ 
                                                    nestedDeepFeed: data.deepFeed 
                                                });
                                                return { ...df, feeds: filteredFeeds };
                                            }
                                            return df;
                                        })
                                    );
                                    if (deepFeedCallbacks[destParentDeepFeedId]) {
                                        deepFeedCallbacks[destParentDeepFeedId]({ type: 'UPDATE_CONTENTS' });
                                    }
                                }
                            } catch (error) {
                                setAsideErrorMessage("Error creating Deep Feed");
                            }
                        }
                    }
                    //If the dragged feed is from outside, add it to the deep feed
                    else if (dragType === 'feed' && destParentDeepFeedId) {
                        try {
                            const sourceFeed = feeds.find(feed => feed.feed_id.toString() === activeId);
                            const { data } = await axios.post("/api/add_to_deep_feed", {
                                deepFeedId: destParentDeepFeedId,
                                feedId: sourceFeed.feed_id,
                                nestedDeepFeedId: null
                            });
                            if (data.success && deepFeedCallbacks[destParentDeepFeedId]) {
                                deepFeedCallbacks[destParentDeepFeedId](sourceFeed);
                            }
                        } catch (error) {
                            setAsideErrorMessage("Error adding to Deep Feed");
                        }
                    }
                }
            }
        } catch (error) {
            setAsideErrorMessage("Error in drag operation");
        }
        setActiveId(null);
        setActiveDragItem(null);
        setDragType(null);
    };

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
                    if (feed.followedFeed) {
                        return feed;
                    }
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

    const registerFeedCallback = useCallback((deepFeedId, callback) => {
        setDeepFeedCallbacks(prev => ({
            ...prev,
            [deepFeedId]: callback
        }));
    }, []);

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
            <aside className="left-aside" ref={feedContainerRef}>
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
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <nav id="personal-feeds">
                            <ul>
                                {/*<li className="channel-link"><Link to="/d/recommended">Recommended</Link></li>*/}
                                <li className="channel-link"><Link to="/d/following">Following</Link></li>
                                {/*<li className="channel-link"><Link to="/d/connection_posts">Connections</Link></li>*/}
                            </ul>
                        </nav>
                        <div className="deep-feeds-container">
                            <SortableContext items={deepFeeds.map(df => `df-${df.deep_feed_id}`)} strategy={verticalListSortingStrategy}>
                                {deepFeeds.map((deepFeed, index) => (
                                    <DeepFeedItem 
                                        key={deepFeed.deep_feed_id} 
                                        deepFeed={deepFeed} 
                                        index={index} 
                                        onFeedAdded={registerFeedCallback} 
                                        showHeader={true}
                                    />
                                ))}
                            </SortableContext>
                        </div>
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
                            <SortableContext items={feeds.map(feed => feed.feed_id.toString())} strategy={verticalListSortingStrategy}>
                                <ul className="feeds-list">
                                    {feeds.length === 0 ? (
                                        <p>Followed feeds are shown here</p>
                                    ) : (
                                        feeds.map((feed, index) => (
                                            <FeedItem key={feed.feed_id} feed={feed.followedFeed} id={feed.feed_id.toString()} isChat={false} />
                                        ))
                                    )}
                                </ul>
                            </SortableContext>
                        </nav>
                        <DragOverlay>
                            {activeId && activeDragItem && dragType === 'feed' && (
                                <div className="feed-list-item feed-drag-overlay">
                                    <div className="feed-list-link-container">
                                        <div className="feed-list-link">
                                            <img className="small-feed-photo" src={`/${activeDragItem.followedFeed.feed_photo}`} alt="Feed" />
                                            <p className="feed-list-text">{activeDragItem.followedFeed.feed_name}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeId && activeDragItem && dragType === 'deepFeed' && (
                                <div className="deep-feed-container deep-feed-drag-overlay">
                                    <div className="channel-link deep-feed-header">
                                        <p style={{ margin: "0" }}>{activeDragItem.name}</p>
                                    </div>
                                </div>
                            )}
                            {activeId && activeDragItem && dragType === 'feedInDeepFeed' && (
                                <div className="feed-list-item feed-drag-overlay">
                                    <div className="feed-list-link-container">
                                        <div className="feed-list-link">
                                            <img className="small-feed-photo" src={`/${activeDragItem.feed.feed_photo}`} alt="Feed" />
                                            <p className="feed-list-text">{activeDragItem.feed.feed_name}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeId && activeDragItem && dragType === 'nestedDeepFeed' && (
                                <div className="deep-feed-container deep-feed-drag-overlay">
                                    <div className="channel-link deep-feed-header">
                                        <p style={{ margin: "0" }}>{activeDragItem.nestedDeepFeed.name}</p>
                                    </div>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    <div style={{marginTop: '64px'}}>
                        <Link to="/join" className="large-icon">
                            <FaArrowRight />
                            <p className="icon-text">Join</p>
                        </Link>
                        <Link to="/login" className="large-icon">
                            <FaSignInAlt />
                            <p className="icon-text">Login</p>
                        </Link>
                        <p style={{marginTop: '20px'}}>Join or login for more</p>
                    </div>
                )}
            </aside>
            <main>
                <header id="base-header">
                    <div className="spacer"></div>
                    <form className="search-form" onSubmit={handleSearchClick}>
                        <div className="search-container">
                            <button className="icon-button ask" data-tooltip="Ask" type="button" onClick={handleAskClick}>
                                <img className="standard-icon" src="/media/site_images/icons/ask.png" alt="Ask"/>
                            </button>
                            <input 
                                className="search-bar" 
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