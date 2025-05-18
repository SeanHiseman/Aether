import axios from 'axios';
import Cropper from 'react-easy-crop';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FaArrowRight, FaFileUpload, FaMinus, FaPlus, FaPlusCircle, FaSignInAlt } from 'react-icons/fa';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import DeepFeedItem from '../components/channels/deepFeedItem';
import FeedItem from '../components/channels/feedItem';
import GetCroppedImg from '../components/getCroppedImg';
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
    const [activeId, setActiveId] = useState(null);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [asideErrorMessage, setAsideErrorMessage] = useState('');
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [currentQuery, setCurrentQuery] = useState('');
    const [deepFeeds, setDeepFeeds] = useState([]);
    const [deepFeedCallbacks, setDeepFeedCallbacks] = useState({});
    const [dragType, setDragType] = useState(null);
    const [feeds, setFeeds] = useState([]);
    const feedContainerRef = useRef(null);
    const [feedsOffset, setFeedsOffset] = useState(0);
    const [feedName, setFeedName] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState(null);
    const [feedType, setFeedType] = useState('public'); 
    const [feed, setFeed] = useState([]);
    const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
    const [headerErrorMessage, setHeaderErrorMessage] = useState('');
    const [imageSrc, setImageSrc] = useState(null);
    const { setTheme } = useContext(ThemeContext);
    const [showForm, setShowForm] = useState(false);
    const { state } = useContext(UnreadContext);
    const navigate = useNavigate();
    const hasMembership = user?.has_membership;
	const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024;
    const [zoom, setZoom] = useState(1);
    
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
        let parentDeepFeedId = active.data.current?.parentDeepFeedId || null;
        if (typeof activeId === 'string' && activeId.startsWith('df-item-')) {
            console.log("df-item-");
            dragType = 'feedInDeepFeed';
            const feedId = activeId.replace('df-item-', '');
            const parentDeepFeed = deepFeeds.find(df => df.deep_feed_id === parentDeepFeedId);
            if (parentDeepFeed && parentDeepFeed.feeds) {
                const content = parentDeepFeed.feeds.find(item => 
                    item.feed && item.feed.feed_id === feedId
                );
                if (content) {
                    dragItem = {
                        feed: content.feed,
                        parentDeepFeedId: parentDeepFeedId
                    };
                } else {
                    //Try to find in all deep feeds if parent ID is wrong (needs to be removed)
                    for (const deepFeed of deepFeeds) {
                        if (deepFeed.feeds) {
                            const fallbackContent = deepFeed.feeds.find(item => 
                                item.feed && item.feed.feed_id === feedId
                            );
                            if (fallbackContent) {
                                dragItem = {
                                    feed: fallbackContent.feed,
                                    parentDeepFeedId: deepFeed.deep_feed_id
                                };
                                break;
                            }
                        }
                    }
                }
            } else {
                console.log("Parent deep feed not found or has no feeds");
            }
        } else if (typeof activeId === 'string' && activeId.startsWith('df-')) {
            console.log("df-");
            dragType = 'deepFeed';
            const deepFeedId = activeId.replace('df-', '');
            dragItem = deepFeeds.find(df => df.deep_feed_id === deepFeedId);
            console.log("dragItem two", dragItem);
        } else if (typeof activeId === 'string' && activeId.startsWith('nested-df-')) {
            console.log("nested-df-");
            dragType = 'nestedDeepFeed';
            const nestedDeepFeedId = activeId.replace('nested-df-', '');
            if (active.data.current?.nestedDeepFeed) {
                dragItem = {
                    nestedDeepFeed: active.data.current.nestedDeepFeed,
                    parentDeepFeedId: parentDeepFeedId
                };
                console.log("Found nested deep feed in data:", dragItem);
            }
        } else {
            dragType = 'feed';
            dragItem = feeds.find(feed => feed.feed_id.toString() === activeId);
            console.log("dragItem four", dragItem);
        }
        if (!dragItem && dragType === 'feedInDeepFeed') {
            console.warn("Failed to find feed item using standard methods, trying alternatives");
            const feedId = activeId.replace('df-item-', '');
            const feedFromAllFeeds = feeds.find(feed => feed.feed_id.toString() === feedId);
            if (feedFromAllFeeds) {
                dragItem = {
                    feed: {
                        feed_id: feedFromAllFeeds.feed_id,
                        feed_name: feedFromAllFeeds.followedFeed?.feed_name,
                        feed_photo: feedFromAllFeeds.followedFeed?.feed_photo,
                        is_group: feedFromAllFeeds.link_type === 'g'
                    },
                    parentDeepFeedId: parentDeepFeedId
                };
            console.log("Created dragItem from feeds array:", dragItem);
            }
        }
        setDragType(dragType);
        console.log("drag type", dragType);
        console.log("drag item", dragItem);
        setActiveDragItem(dragItem);
        setActiveId(activeId);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        console.log("Drag ended", { active, over });
        if (!over) {
            console.log("drag ended with no over target", active.id);
            //Case 7: Dragging content outside without a target (removal)
            if (dragType === 'feedInDeepFeed') {
                console.log("case 7");
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
                    setTimeout(() => { setAsideErrorMessage(''); }, 5000);
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
                    setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                }
            }
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        const activeId = active.id;
        const overId = over.id;
        //Skip if dropped on self
        if (activeId === overId) {
            //console.log("drag ended on self", activeId, overId);
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        try {
            const sourceParentDeepFeedId = active.data.current?.parentDeepFeedId;
            const targetParentDeepFeedId = over.data.current?.parentDeepFeedId;
            console.log("sourceParentDeepFeedId", sourceParentDeepFeedId);
            console.log("targetParentDeepFeedId", targetParentDeepFeedId);
            console.log("dragType", dragType);
            console.log("activeId", activeId);
            console.log("overId", overId);
            console.log("over data", over.data.current);
            console.log("active data", active.data.current);
            //Case 1: Creating a new deep feed by combining 2 feeds in feed list
            if (dragType === 'feed' && typeof overId === 'string' && !overId.startsWith('df-') && !overId.startsWith('df-item-') && !sourceParentDeepFeedId) {
                console.log("case 1");
                const sourceFeed = feeds.find(feed => feed.feed_id.toString() === activeId);
                const destinationFeed = feeds.find(feed => feed.feed_id.toString() === overId);
                if (sourceFeed && destinationFeed) {
                    const deepFeedName = prompt("Enter deep feed name:");
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
                            navigate(`/d/${data.deepFeed.deep_feed_id}`);
                        }                   
                    }
                }
            }
            //Case 2: Dragging a feed from feed list into a deep feed
            else if (dragType === 'feed' && typeof overId === 'string' && overId.startsWith('df-') && !sourceParentDeepFeedId) {
                console.log("case 2");
                console.log("case 2 targetDeepFeedId", targetParentDeepFeedId);
                const sourceFeed = feeds.find(feed => feed.feed_id.toString() === activeId);
                if (sourceFeed) {
                    try {
                        const { data } = await axios.post("/api/add_to_deep_feed", {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: sourceFeed.feed_id,
                            nestedDeepFeedId: null
                        });
                        if (data.success) {
                            if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                deepFeedCallbacks[targetParentDeepFeedId](sourceFeed.followedFeed); //DeepFeedItem uses data from followedFeed
                            } else {
                                setAsideErrorMessage("Error updating feep feed");
                                setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                            }
                        }
                    } catch (error) {
                        setAsideErrorMessage("Error updating deep feed");
                        setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                    }
                }
            }
            //Case 3: Creating a nested deep feed (two feeds dragged and dropped together in same deep feed) 
            else if (dragType === 'feedInDeepFeed' && typeof overId === 'string' && overId.startsWith('df-item-') && sourceParentDeepFeedId === targetParentDeepFeedId) {
                console.log("case 3");
                console.log("Creating nested deep feed"); 
                const sourceFeedId = activeDragItem.feed.feed_id;
                const destFeedId = overId.replace('df-item-', '');
                if (sourceFeedId === destFeedId) {
                    setActiveId(null);
                    setActiveDragItem(null);
                    setDragType(null);
                    return;
                }
                const deepFeedName = prompt("Enter deep feed name:");
                if (deepFeedName) {
                    try {
                        const { data } = await axios.post("/api/create_deep_feed", {
                            viewerId: viewer.feed_id,
                            deepFeedName,
                            feedsToInclude: [sourceFeedId, destFeedId],
                            parentDeepFeedId: sourceParentDeepFeedId
                        });
                        if (data.success && data.deepFeed) {
                            const parentDeepFeed = deepFeeds.find(df => df.deep_feed_id === sourceParentDeepFeedId);
                            if (parentDeepFeed && deepFeedCallbacks[sourceParentDeepFeedId]) {
                                deepFeedCallbacks[sourceParentDeepFeedId]({ type: 'UPDATE_CONTENTS' });
                                setDeepFeeds(prevDeepFeeds => 
                                    prevDeepFeeds.map(df => {
                                        if (df.deep_feed_id === sourceParentDeepFeedId) {
                                            const currentFeeds = [...(df.feeds || [])];
                                            const filteredFeeds = currentFeeds.filter(item => 
                                                !(item.feed && (
                                                    item.feed.feed_id === sourceFeedId || 
                                                    item.feed.feed_id === destFeedId
                                                ))
                                            );
                                            filteredFeeds.push({ 
                                                nestedDeepFeed: data.deepFeed 
                                            });
                                            return { ...df, feeds: filteredFeeds };
                                        }
                                        return df;
                                    })
                                );
                            }
                        }
                    } catch (error) {
                        console.log("Error creating nested deep feed", error);
                        setAsideErrorMessage("Error creating nested Deep Feed");
                        setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                    }
                }
            }
            //Case 4: Moving feed from one deep feed to another
            else if (dragType === 'feedInDeepFeed' && typeof overId === 'string' && overId.startsWith('df-')) {
                console.log("case 4");
                const sourceFeedId = activeDragItem.feed.feed_id;
                //Don't move if source and destination are the same
                if (sourceParentDeepFeedId === targetParentDeepFeedId) {
                    setActiveId(null);
                    setActiveDragItem(null);
                    setDragType(null);
                    return;
                }
                try {
                    const { data: addData } = await axios.post("/api/add_to_deep_feed", {
                        deepFeedId: targetParentDeepFeedId,
                        feedId: sourceFeedId,
                        nestedDeepFeedId: null
                    });
                    if (addData.success) {
                        const { data: removeData } = await axios.post("/api/remove_from_deep_feed", {
                            deepFeedId: sourceParentDeepFeedId,
                            feedId: sourceFeedId
                        });
                        if (removeData.success) {
                            if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                deepFeedCallbacks[targetParentDeepFeedId](activeDragItem.feed);
                            }
                            if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                deepFeedCallbacks[sourceParentDeepFeedId]({ type: 'UPDATE_CONTENTS' });
                            }
                        } else {
                            setAsideErrorMessage("Error removing feed from deep feed");
                            setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                        }
                    } else {
                        setAsideErrorMessage("Error adding feed to deep feed");
                        setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                    }
                } catch (error) {
                    console.log("Error moving feed between deep feeds", error);
                    setAsideErrorMessage("Error moving feed between deep feeds");
                    setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                }
            }
            //Case 5: Moving nested deep feed from one deep feed to another
            else if (dragType === 'nestedDeepFeed' && typeof overId === 'string' && overId.startsWith('df-')) {
                console.log("case 5");
                const nestedDeepFeedId = activeDragItem.nestedDeepFeed.deep_feed_id;
                if (sourceParentDeepFeedId === targetParentDeepFeedId) {
                    setActiveId(null);
                    setActiveDragItem(null);
                    setDragType(null);
                    return;
                }
                try {
                    const { data: addData } = await axios.post("/api/add_to_deep_feed", {
                        deepFeedId: targetParentDeepFeedId,
                        feedId: null,
                        nestedDeepFeedId: nestedDeepFeedId
                    });
                    if (addData.success) {
                        const { data: removeData } = await axios.post("/api/remove_from_deep_feed", {
                            deepFeedId: sourceParentDeepFeedId,
                            nestedDeepFeedId: nestedDeepFeedId
                        });
                        if (removeData.success) {
                            if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                deepFeedCallbacks[targetParentDeepFeedId]({
                                    type: 'ADD_NESTED_DEEP_FEED',
                                    nestedDeepFeed: activeDragItem.nestedDeepFeed
                                });
                            }
                            if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                deepFeedCallbacks[sourceParentDeepFeedId]({ type: 'UPDATE_CONTENTS' });
                            }
                        } else {
                            setAsideErrorMessage("Error removing deep feed");
                            setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                        }
                    } else {
                        setAsideErrorMessage("Error adding deep feed");
                        setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                    }
                } catch (error) {
                    setAsideErrorMessage("Error moving deep feed");
                    setTimeout(() => { setAsideErrorMessage(''); }, 5000);
                }
            }
        } catch (error) {
            console.log("Error in drag operation", error);
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
                setTimeout(() => { setAsideErrorMessage(''); }, 5000);
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
            if (imageSrc && croppedAreaPixels) {
                try {
                    const croppedBlob = await GetCroppedImg(imageSrc, croppedAreaPixels);
                    newFeed.append('new_feed_photo', croppedBlob, 'cropped.jpg');
                } catch {
                    setAsideErrorMessage("Failed to crop image");
                    return;
                }
            } else if (feedPhotoFile) {
                newFeed.append('new_feed_photo', feedPhotoFile);
            }
            const response = await axios.post('/api/create_feed', newFeed, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            if (response.data.success === true) {
                const createdFeed = response.data.feed;
                setFeeds((prevFeeds) => [
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
                setTimeout(() => { setAsideErrorMessage(''); }, 10000);
            } else {
                setAsideErrorMessage("Error creating feed");
                setTimeout(() => { setAsideErrorMessage(''); }, 5000);
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
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result);
            };
            reader.readAsDataURL(file);
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
            setTimeout(() => { setAsideErrorMessage(''); }, 5000);
        }
    };

    const handleSearchClick = (event) => {
        event.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };

    const onCropComplete = useCallback((_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

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
                                {deepFeeds.map((deepFeed) => (
                                    <DeepFeedItem key={deepFeed.deep_feed_id} deepFeed={deepFeed} handleDragStart={handleDragStart} handleDragEnd={handleDragEnd} onFeedAdded={registerFeedCallback} showHeader={true} />
                                ))}
                            </SortableContext>
                        </div>
                        <p className="error-message">{asideErrorMessage}</p>
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
                                        <input type="file" id="feed-photo-input" name="Feed photo" accept="image/*" onChange={handleFileChange} hidden />
                                        <span className="file-name">{feedPhotoFile ? feedPhotoFile.name : 'No file chosen'}</span>
                                    </div>
                                    {imageSrc && (
                                        <div className="crop-container" style={{ position: 'relative', width: '100%', height: 180 }}>
                                            <Cropper
                                                image={imageSrc}
                                                crop={crop}
                                                zoom={zoom}
                                                aspect={1}
                                                onCropChange={setCrop}
                                                onZoomChange={setZoom}
                                                onCropComplete={onCropComplete}
                                            />
                                        </div>
                                    )}
                                    <div className="option-toggle">
                                        <button className={feedType === 'public' ? 'active-mode' : 'passive-mode'} onClick={(event) => {
                                            event.preventDefault();
                                            setFeedType('public');
                                        }} title="Visible to everyone">
                                            Public
                                        </button>
                                        <button className={feedType === 'private' ? 'active-mode' : 'passive-mode'} onClick={(event) => {
                                            event.preventDefault();
                                            setFeedType('private');
                                        }} title="Requires permission to follow">
                                            Private
                                        </button>
                                    </div>
                                    <button className={feedName.length === 0 ? "small-icon disabled" : "small-icon"} disabled={feedName.length === 0} title={feedName.length === 0 ? "Enter a name" : "Create"} type="submit" value="Create">
                                        <FaPlus />
                                    </button>
                                    {asideErrorMessage && <div className="error-message">{asideErrorMessage}</div>}
                                </form>
                            )}
                        </div>
                        <nav className="feed-list">
                            <SortableContext items={feeds.map(feed => feed.feed_id.toString())} strategy={verticalListSortingStrategy}>
                                <ul className="feeds-list">
                                    {feeds.length === 0 ? (
                                        <p>Followed feeds are shown here</p>
                                    ) : (
                                        feeds.map((feed) => (
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
                                <MagnifyingGlassIcon className="standard-icon" style={{ transform: 'scale(1.3)' }}/>
                            </button>
                        </div>
                    </form>
                    <div className="spacer">
                        <p className="error-message">{headerErrorMessage}</p>
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