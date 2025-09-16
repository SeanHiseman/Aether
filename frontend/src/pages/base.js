import axios from "axios";
import Cropper from "react-easy-crop";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FaArrowRight, FaCog, FaFileUpload, FaMinus, FaPlus, FaPlusCircle, FaSignInAlt } from "react-icons/fa";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { v4 } from "uuid";
import { AuthContext } from "../components/authContext";
import DeepFeedItem from "../components/channels/deepFeedItem";
import FeedItem from "../components/channels/feedItem";
import GetCroppedImg from "../components/getCroppedImg";
import { ThemeContext } from "../themeProvider";
import { Tooltip } from "react-tooltip";
import { UnreadContext } from "../components/connections/unreadContext";
import { ValidateTextInput } from "../functions/validateTextInput";
import "../css/algorithms.css"; //Project code
import "../css/baseLayout.css";
import "../css/basicStyles.css";
import "../css/contentFeed.css";
import "../css/contentForm.css";
import "../css/feed.css";
import "../css/membership.css";
import "../css/messages.css";

const BaseLayout = () => {
	const [activeDragItem, setActiveDragItem] = useState(null);
	const [activeId, setActiveId] = useState(null);
	const [asideErrorMessage, setAsideErrorMessage] = useState("");
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
	const [currentQuery, setCurrentQuery] = useState("");
	const [deepFeedCallbacks, setDeepFeedCallbacks] = useState({});
	const [deepFeeds, setDeepFeeds] = useState([]);
	const [desk, setDesk] = useState({ left: false, right: false });
	const [dragType, setDragType] = useState(null);
	const [feed, setFeed] = useState([]);
	const feedContainerRef = useRef(null);
	const [feedName, setFeedName] = useState("");
	const [feedPhotoFile, setFeedPhotoFile] = useState(null);
	const [feedType, setFeedType] = useState("public");
	const [feeds, setFeeds] = useState([]);
	const [feedsOffset, setFeedsOffset] = useState(0);
	const [hasMoreFeeds, setHasMoreFeeds] = useState(true);
	const [headerErrorMessage, setHeaderErrorMessage] = useState("");
	const [imageSrc, setImageSrc] = useState(null);
    const [isFeedNameValid, setIsFeedNameValid] = useState(true);  
	const [mobileOpen, setMobileOpen] = useState(null);
	const [showForm, setShowForm] = useState(false);
	const [zoom, setZoom] = useState(1);
	const { isAuthenticated, user, viewer } = useContext(AuthContext);
	const { setTheme } = useContext(ThemeContext);
	const { state } = useContext(UnreadContext);
	const navigate = useNavigate();
	const hasMembership = user?.has_membership;
	const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024;
	const isMobile = () => window.matchMedia("(max-width:768px)").matches;
	const toggleLeft = () => { if (isMobile()) setMobileOpen(mobileOpen === "left" ? null : "left"); else setDesk(d => ({ ...d, left: !d.left })); };
	const toggleRight = () => { if (isMobile()) setMobileOpen(mobileOpen === "right" ? null : "right"); else setDesk(d => ({ ...d, right: !d.right })); };
	const closeDrawers = () => setMobileOpen(null);
	const contentClasses = ["content", desk.left ? "hide-left" : "", desk.right ? "hide-right" : "", isMobile() && mobileOpen === "left" ? "shift-right" : ""].join(" ");
	const leftClasses = ["left-aside", desk.left ? "collapsed" : "", isMobile() && mobileOpen === "left" ? "open" : ""].join(" ");
	const rightClasses = ["right-aside", desk.right ? "collapsed" : "", isMobile() && mobileOpen === "right" ? "open" : ""].join(" ");
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const dragStart = event => {
        const { active } = event;
        const activeId = active.id;
        const dragData = active.data.current;
        let dragType = "feed";
        let dragItem = null;
        let feedId;
        if (activeId.startsWith('df-')) {
            const parts = activeId.split('-');
            feedId = parts[parts.length - 1];
            dragType = "feedInDeepFeed";
        } else if (activeId.startsWith('sidebar-feed-')) {
            feedId = activeId.replace('sidebar-feed-', '');
            dragType = "feed";
        } else {
            feedId = activeId;
        }
        if (dragData?.parentDeepFeedId) {
            dragType = "feedInDeepFeed";
            dragItem = { 
                feed: dragData.feed, 
                parentDeepFeedId: dragData.parentDeepFeedId 
            };
        }
        else {
            dragItem = feeds.find(f => f.feed_id.toString() === feedId);
        }
        setDragType(dragType);
        setActiveDragItem(dragItem);
        setActiveId(activeId);
    };

    const dragEnd = async event => {
        const { active, over } = event;
        //If dropped outside any droppable area, remove from deep feed
        if (!over) {
            if (dragType === "feedInDeepFeed" && activeDragItem) {
                try {
                    const payload = {
                        deepFeedId: activeDragItem.parentDeepFeedId,
                        feedId: activeDragItem.feed.feed_id
                    };
                    const { data } = await axios.post("/api/remove_from_deep_feed", payload);
                    if (data.success && deepFeedCallbacks[activeDragItem.parentDeepFeedId]) {
                        deepFeedCallbacks[activeDragItem.parentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                    }
                }
                catch (error) {
                    console.log("Error removing from combined feed:", error);
                    setAsideErrorMessage("Error removing from combined feed");
                    setTimeout(() => setAsideErrorMessage(""), 5000);
                }
            }
            resetDragState();
            return;
        }
        const activeId = active.id;
        const overId = over.id;
        const overData = over.data.current;
        let targetFeedId;
        if (overId.toString().startsWith('sidebar-feed-')) {
            targetFeedId = overId.toString().replace('sidebar-feed-', '');
        } else if (overId.toString().includes('-feed-')) {
            const parts = overId.toString().split('-');
            targetFeedId = parts[parts.length - 1];
        }
        //Check if the overId is a deep feed (not a feed within a deep feed)
        const isOverDeepFeed = (overId.toString().startsWith('df-') && !overId.toString().includes('-feed-')) 
            || overData?.type === 'deepFeed';
        let targetDeepFeedId;
        if (isOverDeepFeed) {
            if (overData?.deepFeedId) {
                targetDeepFeedId = overData.deepFeedId;
            } else if (overId.toString().startsWith('df-')) {
                targetDeepFeedId = overId.toString().replace('df-', '');
            }
        }
        //Don't do anything if dropping on self
        if (activeId === overId) {
            resetDragState();
            return;
        }
        try {
            //Case 1: Regular feed from sidebar dropped on deep feed
            if (dragType === "feed" && isOverDeepFeed && targetDeepFeedId) {
                const sourceFeed = activeDragItem;
                if (sourceFeed) {
                    const payload = {
                        deepFeedId: targetDeepFeedId,
                        feedId: sourceFeed.feed_id
                    };
                    const { data } = await axios.post("/api/add_to_deep_feed", payload);
                    if (data.success && deepFeedCallbacks[targetDeepFeedId]) {
                        deepFeedCallbacks[targetDeepFeedId]({ type: "UPDATE_CONTENTS" });
                    }
                }
            }
            //Case 2: Feed from deep feed dropped on another deep feed
            else if (dragType === "feedInDeepFeed" && isOverDeepFeed && targetDeepFeedId) {
                const sourceFeedId = activeDragItem.feed.feed_id;
                const sourceDeepFeedId = activeDragItem.parentDeepFeedId;
                //Only proceed if dropping on a different deep feed
                if (sourceDeepFeedId !== targetDeepFeedId) {
                    const addPayload = {
                        deepFeedId: targetDeepFeedId,
                        feedId: sourceFeedId
                    };
                    const { data: addData } = await axios.post("/api/add_to_deep_feed", addPayload);
                    if (addData.success) {
                        const removePayload = {
                            deepFeedId: sourceDeepFeedId,
                            feedId: sourceFeedId
                        };
                        const { data: removeData } = await axios.post("/api/remove_from_deep_feed", removePayload);
                        if (removeData.success) {
                            if (deepFeedCallbacks[targetDeepFeedId]) {
                                deepFeedCallbacks[targetDeepFeedId]({ type: "UPDATE_CONTENTS" });
                            }
                            if (deepFeedCallbacks[sourceDeepFeedId]) {
                                deepFeedCallbacks[sourceDeepFeedId]({ type: "UPDATE_CONTENTS" });
                            }
                        }
                    }
                }
            }
            //Case 3: Two regular feeds from sidebar combine to create new deep feed
            else if (dragType === "feed" && !isOverDeepFeed && targetFeedId) {
                const sourceFeed = activeDragItem;
                const targetFeed = feeds.find(f => f.feed_id.toString() === targetFeedId);
                if (sourceFeed && targetFeed && sourceFeed.feed_id !== targetFeed.feed_id) {
                    const deepFeedName = prompt("Enter name for combined feed:");
                    if (deepFeedName) {
                        const payload = {
                            viewerId: viewer.feed_id,
                            deepFeedName,
                            feedsToInclude: [sourceFeed.feed_id, targetFeed.feed_id]
                        };
                        const { data } = await axios.post("/api/create_deep_feed", payload);
                        if (data.success && data.deepFeed) {
                            const newDeepFeed = {
                                ...data.deepFeed,
                                feeds: data.feedsToInclude.map(id => ({ 
                                    feed: feeds.find(f => f.feed_id === id) 
                                }))
                            };
                            setDeepFeeds(prev => [...prev, newDeepFeed]);
                            navigate(`/d/${data.deepFeed.deep_feed_id}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.log("Error in drag operation:", error);
            setAsideErrorMessage("Error in drag operation");
            setTimeout(() => setAsideErrorMessage(""), 5000);
        }
        resetDragState();
    };

    const resetDragState = () => {
        setActiveId(null);
        setActiveDragItem(null);
        setDragType(null);
    };

    useEffect(() => {
        const fetchViewerFeed = async () => {
            if (isAuthenticated && viewer) {
                try {
                    const res = await axios.get(`/api/feed/${viewer.feed_name}`);
                    setFeed(res.data.feedResult);
                    const themeRes = await axios.get("/api/get_theme");
                    setTheme(themeRes.data.theme);
                }
                catch (error) {
                    if (error.response?.status === 401) {
                        navigate("/login");
                    }
                }
            }
        };
        fetchViewerFeed();
    }, [isAuthenticated, navigate, setTheme, viewer]);

    useEffect(() => {
        if (!isAuthenticated || !viewer?.feed_id || !hasMoreFeeds) {
            return;
        }
        (async () => {
            try {
                const res = await axios.get("/api/feed_list", {
                    params: {
                        followerId: viewer.feed_id,
                        offset: feedsOffset,
                        limit: 30
                    }
                });
                const newFeeds = res.data.formattedFeeds;
                if (newFeeds.length < 30) {
                    setHasMoreFeeds(false);
                }
                const normalized = newFeeds.map(f => {
                    if (f.followedFeed) {
                        return f;
                    }
                    return {
                        feed_id: f.feed_id,
                        followedFeed: {
                            feed_name: f.feed_name,
                            feed_photo: f.feed_photo
                        },
                        link_type: f.link_type
                    };
                });
                setFeeds(prev => [...prev, ...normalized]);
            }
            catch (error){
                setFeeds([]);
            }
        })();
    }, [feedsOffset, hasMoreFeeds, isAuthenticated, viewer?.feed_id]);

    const registerFeedCallback = useCallback((deepFeedId, callback) => {
        setDeepFeedCallbacks(prev => ({ ...prev, [deepFeedId]: callback }));
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !viewer?.feed_id) {
            return;
        }
        (async () => {
            try {
                const res = await axios.get(`/api/deep_feeds/${viewer.feed_id}`);
                setDeepFeeds(res.data.deepFeeds);
            }
            catch {
                setDeepFeeds([]);
                setAsideErrorMessage("Error fetching combined feeds");
                setTimeout(() => setAsideErrorMessage(""), 5000);
            }
        })();
    }, [isAuthenticated, viewer?.feed_id]);

    useEffect(() => {
        const handleScroll = () => {
            const c = feedContainerRef.current;
            if (c && hasMoreFeeds) {
                const { scrollTop, scrollHeight, clientHeight } = c;
                if (scrollHeight - scrollTop <= clientHeight + 50) {
                    setFeedsOffset(prev => prev + 30);
                }
            }
        };
        const c = feedContainerRef.current;
        if (c) {
            c.addEventListener("scroll", handleScroll);
        }
        return () => {
            if (c) {
                c.removeEventListener("scroll", handleScroll);
            }
        };
    }, [hasMoreFeeds]);

    const askClick = async e => {
        e.preventDefault();
        if (!isAuthenticated) {
            const willLogin = window.confirm("Please log in to continue");
            if (willLogin) {
                navigate("/login", { state: { from: window.location.pathname } });
            }
            return;
        }
        try {
            const trimmed = currentQuery.trim();
            const newChatId = v4();
            if (trimmed) {
                if (user.has_membership) {
                    await axios.post("/api/create_ask_chat", {
                        chatId: newChatId,
                        chatName: "New chat"
                    });
                    navigate(`/ask/${newChatId}`, { state: { initialMessage: trimmed } });
                }
                setCurrentQuery("");
            }
            else {
                navigate("/ask/home");
            }
        }
        catch (error) {
            setHeaderErrorMessage("Error sending Ask");
            setTimeout(() => setAsideErrorMessage(""), 5000);
        }
    };

    const createFeed = async event => {
        if (!isAuthenticated) {
            return;
        }
        try {
            event.preventDefault();
            if (!feedName) {
                setAsideErrorMessage("Feed needs a name");
                return;
            }
            const form = new FormData();
            form.append("feedName", feedName);
            form.append("type", feedType);
            form.append("isGroup", true);
            form.append("feedOwner", user.user_id);
            form.append("viewerFeedId", viewer.feed_id);
            if (imageSrc && croppedAreaPixels) {
                try {
                    const blob = await GetCroppedImg(imageSrc, croppedAreaPixels);
                    form.append("new_feed_photo", blob, "cropped.jpg");
                }
                catch (error) {
                    setAsideErrorMessage("Failed to crop image");
                    return;
                }
            }
            else if (feedPhotoFile) {
                form.append("new_feed_photo", feedPhotoFile);
            }
            const response = await axios.post("/api/create_feed", form, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (response.data.success) {
                const created = response.data.feed;
                setFeeds(prev => [
                    ...prev,
                    {
                        feed_id: created.feed_id,
                        followedFeed: {
                            feed_name: created.feed_name,
                            feed_photo: created.feed_photo
                        },
                        link_type: "g"
                    }
                ]);
                setFeedName("");
                setShowForm(false);
                setFeedPhotoFile(null);
                setImageSrc(null);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCroppedAreaPixels(null);
                navigate(`/g/${created.feed_name}`);
            } 
        }
        catch (error) {
            if (error.response?.status === 413) {
                setAsideErrorMessage(
                    (error.response.data?.message || "File too large") +
                    (!user.has_membership ? ". Get membership for more" : "")
                );
                setTimeout(() => setAsideErrorMessage(""), 10000);
            }
            else {
                setAsideErrorMessage(error.response?.data?.message || "Error creating feed");
                setTimeout(() => setAsideErrorMessage(""), 5000);
            }
        }
    };

    const handleFileChange = event => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                setAsideErrorMessage(
                    hasMembership
                        ? `File exceeds your max size limit of 100MB.`
                        : `File exceeds your max size limit of 1MB. Get membership for more.`
                );
                return;
            }
            setFeedPhotoFile(file);
            const reader = new FileReader();
            reader.onload = () => setImageSrc(reader.result);
            reader.readAsDataURL(file);
            setAsideErrorMessage("");
        }
    };

    const onCropComplete = useCallback((_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const searchClick = e => {
        e.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };

    const toggleForm = () => {
        if (showForm) {
            setFeedName("");
            setFeedPhotoFile(null);
            setImageSrc(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
        }
        setShowForm(!showForm);
        setAsideErrorMessage("");
    };

    return (
        <>
            {mobileOpen && (
                <div className="backdrop" onClick={closeDrawers} />
            )}
            <div className="container">
                <aside className={leftClasses} ref={feedContainerRef}>
                    <div className="left-aside-feed-info">
                        {isAuthenticated && (
                            <><Link className="feed-link" to={`/u/${feed.feed_name}`}>
                                <img className="small-feed-photo" src={`/${feed.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                                <p className="feed-list-text">{feed.feed_name}</p>
                            </Link>
                            <Link className="small-icon" to={`/settings/${feed.feed_name}`} title="Settings">
                                <FaCog />
                            </Link></>
                        )}
                    </div>
                    {isAuthenticated ? (
                        <><DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragEnd={dragEnd}>
                            <nav id="personal-feeds">
                                <ul>     
                                    <li className="channel-link">
                                        <Link to="/explore">Explore</Link>
                                    </li>
                                    <li className="channel-link">
                                        <Link to="/d/following">Following</Link>
                                    </li>
                                    <li className="channel-link">
                                        <Link to="/saved/Main">Saved posts</Link>
                                    </li>
                                </ul>
                            </nav>
                            <div className="deep-feeds-container">
                                <SortableContext items={feeds.map(f => f.feed_id.toString())} strategy={verticalListSortingStrategy}>
                                    {deepFeeds.map(deepFeed => (
                                        <DeepFeedItem key={deepFeed.deep_feed_id} deepFeed={deepFeed} handleDragStart={dragStart} handleDragEnd={dragEnd} onFeedAdded={registerFeedCallback} showHeader={true}/>
                                    ))}
                                </SortableContext>
                            </div>
                            <p className="error-message">{asideErrorMessage}</p>
                            <div id="create-feed-section">
                                <button className="small-icon" onClick={toggleForm} style={{alignSelf: "flex-start", marginLeft: "calc(5% + 10px)"}}>
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
                                    {showForm ? "Close" : "Create feed"}
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
                                                const input = e.target.value;
                                                setFeedName(input);
                                                if (input) {
                                                    const result = ValidateTextInput(input, 0, 30);
                                                    if (result.valid) {
                                                        setAsideErrorMessage("");
                                                        setIsFeedNameValid(true);
                                                    } else {
                                                        setAsideErrorMessage(result.error);
                                                        setIsFeedNameValid(false);
                                                    }
                                                } else {
                                                    setAsideErrorMessage("");
                                                    setIsFeedNameValid(false);
                                                }
                                            }}
                                        />
                                        <div className="file-input">
                                            <label htmlFor="feed-photo-input" className="small-icon">
                                                <FaFileUpload />
                                                <p className="icon-text">Choose feed photo</p>
                                            </label>
                                            <input type="file" id="feed-photo-input" name="Feed photo" accept="image/*" onChange={handleFileChange} hidden/>
                                            <p className="text16">
                                                {feedPhotoFile ? feedPhotoFile.name : "No file chosen"}
                                            </p>
                                        </div>
                                        {imageSrc && (
                                            <div className="crop-container" style={{ position: "relative", width: "100%", height: 180 }}>
                                                <Cropper aspect={1} crop={crop} image={imageSrc} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} zoom={zoom}/>
                                            </div>
                                        )}
                                        <div className="option-toggle">
                                            <button
                                                className={feedType === "public" ? "active-mode" : "passive-mode"}
                                                onClick={e => {
                                                    e.preventDefault();
                                                    setFeedType("public");
                                                }}
                                                title="Visible to everyone"
                                            >
                                                Public
                                            </button>
                                            <button
                                                className={feedType === "private" ? "active-mode" : "passive-mode"}
                                                onClick={e => {
                                                    e.preventDefault();
                                                    setFeedType("private");
                                                }}
                                                title="Requires permission to follow"
                                            >
                                                Private
                                            </button>
                                        </div>
                                        <button
                                            className={!isFeedNameValid ? "small-icon disabled" : "small-icon"}
                                            disabled={!isFeedNameValid}
                                            title={!isFeedNameValid ? "Fix input error" : "Create"}
                                            type="submit"
                                            value="Create"
                                        >
                                            <FaPlus />
                                        </button>
                                    </form>
                                )}
                            </div>
                            <nav className="feed-list">
                                <p className="text16 faded-text">
                                    Drag and drop to combine feeds
                                </p>
                                <SortableContext 
                                    items={feeds.map(f => `sidebar-feed-${f.feed_id}`)} 
                                    strategy={verticalListSortingStrategy}
                                >
                                    <ul className="feeds-list">
                                        {feeds.map(f => (
                                            <FeedItem 
                                                key={f.feed_id} 
                                                feed={f.followedFeed} 
                                                id={f.feed_id.toString()} 
                                                isChat={false}
                                            />
                                        ))}
                                    </ul>
                                </SortableContext>
                            </nav>
                            <DragOverlay>
                                {activeId && activeDragItem && dragType === "feed" && (
                                    <div className="feed-list-item feed-drag-overlay">
                                        <div className="feed-list-link-container">
                                            <div className="feed-list-link">
                                                <img
                                                    className="small-feed-photo"
                                                    src={`/${activeDragItem.followedFeed.feed_photo}`}
                                                    alt="Feed"
                                                />
                                                <p className="feed-list-text">
                                                    {activeDragItem.followedFeed.feed_name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {activeId && activeDragItem && dragType === "feedInDeepFeed" && (
                                    <div className="feed-list-item feed-drag-overlay">
                                        <div className="feed-list-link-container">
                                            <div className="feed-list-link">
                                                <img
                                                    className="small-feed-photo"
                                                    src={`/${activeDragItem.feed.feed_photo}`}
                                                    alt="Feed"
                                                />
                                                <p className="feed-list-text">
                                                    {activeDragItem.feed.feed_name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </DragOverlay>
                        </DndContext></>
                    ) : (
                        <div style={{ 
                            alignItems: "center", 
                            display: "flex", 
                            flexDirection: "column",
                            justifyContent: "space-between",
                            height: "80%" 
                        }}>
                            <Link to="/welcome">
                                <p className="large-text faded-text" style={{ fontWeight: 'bold' }}>Aether</p>
                                <p className="large-text faded-text" style={{ fontWeight: 'bold' }}>Social</p>
                            </Link> 
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                <Link to="/join" className="large-icon">
                                    <FaArrowRight />
                                    <p className="icon-text">Join</p>
                                </Link>
                                <Link to="/login" className="large-icon">
                                    <FaSignInAlt />
                                    <p className="icon-text">Login</p>
                                </Link>
                                <p style={{ marginTop: "20px" }}>Join or login for more</p>
                            </div>
                            <div></div>
                        </div>
                    )}
                </aside>
                <main>
                    <header className={"base-header" + (desk.left ? " hide-left" : "") + (desk.right ? " hide-right" : "")}>
                        <button className="sidebar-toggle" onClick={toggleLeft} title={desk.left ? "Open sidebar" : "Close sidebar"}>
                            {(isMobile() && mobileOpen === "left") ||
                            (!isMobile() && !desk.left) ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                	<>
                                        <line x1="21" y1="12" x2="7" y2="12" />
                                        <polyline points="11 8 7 12 11 16" />
                                        <line x1="3" y1="6" x2="3" y2="18" />
                                    </>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                    <>
                                        <line x1="3" y1="12" x2="17" y2="12" />
                                        <polyline points="13 8 17 12 13 16" />
                                        <line x1="21" y1="6" x2="21" y2="18" />
                                    </>
                                </svg>
                            )}
                        </button>
                        <form className="search-form" onSubmit={searchClick}>
                            <div className="search-container">
                                <input
                                    className="search-bar"
                                    type="text"
                                    name="keyword"
                                    placeholder="Search..."
                                    value={currentQuery}
                                    onChange={e => {
                                        const input = e.target.value;
                                        if (input.length <= 1000) {
                                            setCurrentQuery(input);
                                            setHeaderErrorMessage("");
                                        } else {
                                            setHeaderErrorMessage("Query too long");
                                        }
                                    }}
                                />
                                <button className="icon-button search" data-tooltip="Search" title="Search" type="submit">
                                    <MagnifyingGlassIcon className="standard-icon" style={{ transform: "scale(1.3)" }}/>
                                </button>
                            </div>
                        </form>
                        {headerErrorMessage && (
                            <p className="error-message">{headerErrorMessage}</p>
                        )}
                        <button className="sidebar-toggle" onClick={toggleRight} title={desk.right ? "Open sidebar" : "Close sidebar"}>
                            {(isMobile() && mobileOpen === "right") ||
                            (!isMobile() && !desk.right) ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                    <>
                                        <line x1="3" y1="12" x2="17" y2="12" />
                                        <polyline points="13 8 17 12 13 16" />
                                        <line x1="21" y1="6" x2="21" y2="18" />
                                    </>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                	<>
                                        <line x1="21" y1="12" x2="7" y2="12" />
                                        <polyline points="11 8 7 12 11 16" />
                                        <line x1="3" y1="6" x2="3" y2="18" />
                                    </>
                                </svg>
                            )}
                        </button>
                    </header>
                    <div className={contentClasses}>
                        <Outlet context={{ rightClasses }} />
                    </div>
                </main>
            </div>
        </>
    );

};

export default BaseLayout;