import axios from "axios";
import Cropper from "react-easy-crop";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FaArrowRight, FaBars, FaFileUpload, FaMinus, FaPlus, FaPlusCircle, FaSignInAlt, FaTimes } from "react-icons/fa";
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
        const activeIdLocal = active.id;
        let dragTypeLocal = "feed";
        let dragItemLocal = null;
        const parentDeepFeedId = active.data.current?.parentDeepFeedId || null;
        if (typeof activeIdLocal === "string" && activeIdLocal.startsWith("df-item-")) {
            dragTypeLocal = "feedInDeepFeed";
            const feedId = activeIdLocal.replace("df-item-", "");
            const parentDeepFeed = deepFeeds.find(df => df.deep_feed_id === parentDeepFeedId);
            if (parentDeepFeed?.feeds) {
                const content = parentDeepFeed.feeds.find(item => item.feed?.feed_id === feedId);
                if (content) {
                    dragItemLocal = { feed: content.feed, parentDeepFeedId };
                } else {
                    for (const df of deepFeeds) {
                        const fallback = df.feeds?.find(item => item.feed?.feed_id === feedId);
                        if (fallback) {
                            dragItemLocal = { feed: fallback.feed, parentDeepFeedId: df.deep_feed_id };
                            break;
                        }
                    }
                }
            }
        }
        else if (typeof activeIdLocal === "string" && activeIdLocal.startsWith("df-")) {
            dragTypeLocal = "deepFeed";
            const deepFeedId = activeIdLocal.replace("df-", "");
            dragItemLocal = deepFeeds.find(df => df.deep_feed_id === deepFeedId);
        }
        else if (typeof activeIdLocal === "string" && activeIdLocal.startsWith("nested-df-")) {
            dragTypeLocal = "nestedDeepFeed";
            if (active.data.current?.nestedDeepFeed) {
                dragItemLocal = {
                    nestedDeepFeed: active.data.current.nestedDeepFeed,
                    parentDeepFeedId
                };
            } else {
                dragItemLocal = null;
            }
        }
        else {
            dragItemLocal = feeds.find(f => f.feed_id.toString() === activeIdLocal);
        }
        if (!dragItemLocal && dragTypeLocal === "feedInDeepFeed") {
            const feedId = activeIdLocal.replace("df-item-", "");
            const feedFromAll = feeds.find(f => f.feed_id.toString() === feedId);
            if (feedFromAll) {
                dragItemLocal = {
                    feed: {
                        feed_id: feedFromAll.feed_id,
                        feed_name: feedFromAll.followedFeed?.feed_name,
                        feed_photo: feedFromAll.followedFeed?.feed_photo,
                        is_group: feedFromAll.link_type === "g"
                    },
                    parentDeepFeedId
                };
            }
        }
        setDragType(dragTypeLocal);
        setActiveDragItem(dragItemLocal);
        setActiveId(activeIdLocal);
    };

    const dragEnd = async event => {
        const { active, over } = event;
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
                catch {
                    setAsideErrorMessage("Error removing from Deep Feed");
                    setTimeout(() => setAsideErrorMessage(""), 5000);
                }
            }
            else if (dragType === "nestedDeepFeed" && activeDragItem) {
                try {
                    const payload = {
                        deepFeedId: activeDragItem.parentDeepFeedId,
                        nestedDeepFeedId: activeDragItem.nestedDeepFeed.deep_feed_id
                    };
                    const { data } = await axios.post("/api/remove_from_deep_feed", payload);
                    if (data.success && deepFeedCallbacks[activeDragItem.parentDeepFeedId]) {
                        deepFeedCallbacks[activeDragItem.parentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                    }
                }
                catch {
                    setAsideErrorMessage("Error removing nested deep feed");
                    setTimeout(() => setAsideErrorMessage(""), 5000);
                }
            }
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        const activeIdLocal = active.id;
        const overId = over.id;
        if (activeIdLocal === overId) {
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        try {
            const sourceParentDeepFeedId = active.data.current?.parentDeepFeedId;
            const targetParentDeepFeedId = over.data.current?.parentDeepFeedId;
            // Case 1: two feeds combine into a new deep feed
            if (
                dragType === "feed"
                && typeof overId === "string"
                && !overId.startsWith("df-")
                && !overId.startsWith("df-item-")
                && !sourceParentDeepFeedId
            ) {
                const sourceFeed = feeds.find(f => f.feed_id.toString() === activeIdLocal);
                const destFeed = feeds.find(f => f.feed_id.toString() === overId);
                if (sourceFeed && destFeed) {
                    const deepFeedName = prompt("Enter deep feed name:");
                    if (deepFeedName) {
                        const payload = {
                            viewerId: viewer.feed_id,
                            deepFeedName,
                            feedsToInclude: [sourceFeed.feed_id, destFeed.feed_id]
                        };
                        const { data } = await axios.post("/api/create_deep_feed", payload);
                        if (data.success && data.deepFeed) {
                            const newDeep = {
                                ...data.deepFeed,
                                feeds: data.feedsToInclude.map(id => ({ feed: feeds.find(f => f.feed_id === id) }))
                            };
                            setDeepFeeds(prev => [...prev, newDeep]);
                            navigate(`/d/${data.deepFeed.deep_feed_id}`);
                        }
                    }
                }
            }
            // Case 2: feed → existing deep feed
            else if (
                dragType === "feed"
                && typeof overId === "string"
                && overId.startsWith("df-")
                && !sourceParentDeepFeedId
            ) {
                const sourceFeed = feeds.find(f => f.feed_id.toString() === activeIdLocal);
                if (sourceFeed) {
                    try {
                        const payload = {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: sourceFeed.feed_id,
                            nestedDeepFeedId: null
                        };
                        const { data } = await axios.post("/api/add_to_deep_feed", payload);
                        if (data.success) {
                            if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                deepFeedCallbacks[targetParentDeepFeedId](sourceFeed.followedFeed);
                            }
                            else {
                                setAsideErrorMessage("Error updating feep feed");
                                setTimeout(() => setAsideErrorMessage(""), 5000);
                            }
                        }
                    }
                    catch {
                        setAsideErrorMessage("Error updating deep feed");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                    }
                }
            }
            // Case 3: two feeds inside same deep feed → nested deep feed
            else if (
                dragType === "feedInDeepFeed"
                && typeof overId === "string"
                && overId.startsWith("df-item-")
                && sourceParentDeepFeedId === targetParentDeepFeedId
            ) {
                const sourceFeedId = activeDragItem.feed.feed_id;
                const destFeedId = overId.replace("df-item-", "");
                if (sourceFeedId !== destFeedId) {
                    const deepFeedName = prompt("Enter deep feed name:");
                    if (deepFeedName) {
                        try {
                            const payload = {
                                viewerId: viewer.feed_id,
                                deepFeedName,
                                feedsToInclude: [sourceFeedId, destFeedId],
                                parentDeepFeedId: sourceParentDeepFeedId
                            };
                            const { data } = await axios.post("/api/create_deep_feed", payload);
                            if (data.success && data.deepFeed) {
                                if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                    deepFeedCallbacks[sourceParentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                                }
                                setDeepFeeds(prev => prev.map(df => {
                                    if (df.deep_feed_id === sourceParentDeepFeedId) {
                                        const filtered = (df.feeds || []).filter(item =>
                                            !(item.feed && (item.feed.feed_id === sourceFeedId || item.feed.feed_id === destFeedId))
                                        );
                                        return {
                                            ...df,
                                            feeds: [
                                                ...filtered,
                                                { nestedDeepFeed: data.deepFeed }
                                            ]
                                        };
                                    }
                                    return df;
                                }));
                            }
                        }
                        catch {
                            setAsideErrorMessage("Error creating nested Deep Feed");
                            setTimeout(() => setAsideErrorMessage(""), 5000);
                        }
                    }
                }
            }
            // Case 4: move feed from one deep feed to another
            else if (
                dragType === "feedInDeepFeed"
                && typeof overId === "string"
                && overId.startsWith("df-")
            ) {
                const sourceFeedId = activeDragItem.feed.feed_id;
                if (sourceParentDeepFeedId !== targetParentDeepFeedId) {
                    try {
                        const addPayload = {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: sourceFeedId,
                            nestedDeepFeedId: null
                        };
                        const { data: addData } = await axios.post("/api/add_to_deep_feed", addPayload);
                        if (addData.success) {
                            const removePayload = {
                                deepFeedId: sourceParentDeepFeedId,
                                feedId: sourceFeedId
                            };
                            const { data: removeData } = await axios.post("/api/remove_from_deep_feed", removePayload);
                            if (removeData.success) {
                                if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                    deepFeedCallbacks[targetParentDeepFeedId](activeDragItem.feed);
                                }
                                if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                    deepFeedCallbacks[sourceParentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                                }
                            }
                            else {
                                setAsideErrorMessage("Error removing feed from deep feed");
                                setTimeout(() => setAsideErrorMessage(""), 5000);
                            }
                        }
                        else {
                            setAsideErrorMessage("Error adding feed to deep feed");
                            setTimeout(() => setAsideErrorMessage(""), 5000);
                        }
                    }
                    catch {
                        setAsideErrorMessage("Error moving feed between deep feeds");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                    }
                }
            }
            // Case 5: move nested deep feed to another deep feed
            else if (
                dragType === "nestedDeepFeed"
                && typeof overId === "string"
                && overId.startsWith("df-")
            ) {
                const nestedDeepFeedId = activeDragItem.nestedDeepFeed.deep_feed_id;
                if (sourceParentDeepFeedId !== targetParentDeepFeedId) {
                    try {
                        const addPayload = {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: null,
                            nestedDeepFeedId
                        };
                        const { data: addData } = await axios.post("/api/add_to_deep_feed", addPayload);
                        if (addData.success) {
                            const removePayload = {
                                deepFeedId: sourceParentDeepFeedId,
                                nestedDeepFeedId
                            };
                            const { data: removeData } = await axios.post("/api/remove_from_deep_feed", removePayload);
                            if (removeData.success) {
                                if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                    deepFeedCallbacks[targetParentDeepFeedId]({
                                        type: "ADD_NESTED_DEEP_FEED",
                                        nestedDeepFeed: activeDragItem.nestedDeepFeed
                                    });
                                }
                                if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                    deepFeedCallbacks[sourceParentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                                }
                            }
                            else {
                                setAsideErrorMessage("Error removing deep feed");
                                setTimeout(() => setAsideErrorMessage(""), 5000);
                            }
                        }
                        else {
                            setAsideErrorMessage("Error adding deep feed");
                            setTimeout(() => setAsideErrorMessage(""), 5000);
                        }
                    }
                    catch {
                        setAsideErrorMessage("Error moving deep feed");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                    }
                }
            }
        }
        catch {
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
            catch {
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
                setAsideErrorMessage("Error fetching deep feeds");
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
        catch {
            setHeaderErrorMessage("Error sending Ask");
            setTimeout(() => setAsideErrorMessage(""), 5000);
        }
    };

    const createFeed = async e => {
        if (!isAuthenticated) {
            return;
        }
        try {
            e.preventDefault();
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
                catch {
                    setAsideErrorMessage("Failed to crop image");
                    return;
                }
            }
            else if (feedPhotoFile) {
                form.append("new_feed_photo", feedPhotoFile);
            }

            const res = await axios.post("/api/create_feed", form, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (res.data.success) {
                const created = res.data.feed;
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
                    error.response.data.message +
                    (!user.has_membership ? ". Get membership for more" : "")
                );
                setTimeout(() => setAsideErrorMessage(""), 10000);
            }
            else {
                setAsideErrorMessage("Error creating feed");
                setTimeout(() => setAsideErrorMessage(""), 5000);
            }
        }
    };

    const handleFileChange = e => {
        const file = e.target.files[0];
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
                            <Link className="feed-link" to={`/u/${feed.feed_name}`}>
                                <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt="Feed"/>
                                <p className="feed-list-text">{feed.feed_name}</p>
                            </Link>
                        )}
                    </div>
                    {isAuthenticated ? (
                        <>{/*<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragEnd={dragEnd}>*/}
                            <nav id="personal-feeds">
                                <ul>
                                    <li className="channel-link">
                                        <Link to="/d/following">Following</Link>
                                    </li>
                                </ul>
                            </nav>
                            {/*<div className="deep-feeds-container">
                                {deepFeeds.length === 0 && (
                                    <p className="text16 faded-text">
                                        Drag and drop feeds together (experimental)
                                    </p>
                                )}
                                <SortableContext items={deepFeeds.map(df => `df-${df.deep_feed_id}`)} strategy={verticalListSortingStrategy}
                                >
                                    {deepFeeds.map(deepFeed => (
                                        <DeepFeedItem key={deepFeed.deep_feed_id} deepFeed={deepFeed} handleDragStart={dragStart} handleDragEnd={dragEnd} onFeedAdded={registerFeedCallback} showHeader={true}/>
                                    ))}
                                </SortableContext>
                            </div>*/}
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
                                            onChange={e => {
                                                e.preventDefault();
                                                const input = e.target.value;
                                                if (input.length <= 30) {
                                                    setFeedName(input);
                                                    setAsideErrorMessage("");
                                                } else {
                                                    setAsideErrorMessage("Name too long");
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
                                        <button className={feedName.length === 0 ? "small-icon disabled" : "small-icon"} disabled={feedName.length === 0} title={feedName.length === 0 ? "Enter a name" : "Create"} type="submit" value="Create">
                                            <FaPlus />
                                        </button>
                                        {asideErrorMessage && (
                                            <div className="error-message">{asideErrorMessage}</div>
                                        )}
                                    </form>
                                )}
                            </div>
                            <nav className="feed-list">
                                {/*<SortableContext items={feeds.map(f => f.feed_id.toString())} strategy={verticalListSortingStrategy}>*/}
                                    <ul className="feeds-list">
                                        {feeds.length === 0 ? (
                                            <p>Followed feeds are shown here</p>
                                        ) : (
                                            feeds.map(f => (
                                                <FeedItem key={f.feed_id} feed={f.followedFeed} id={f.feed_id.toString()} isChat={false}/>
                                            ))
                                        )}
                                    </ul>
                                {/*</SortableContext>*/}
                            </nav>
                            {/*<DragOverlay>
                                {activeId &&
                                    activeDragItem &&
                                    dragType === "feed" && (
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
                                {activeId &&
                                    activeDragItem &&
                                    dragType === "deepFeed" && (
                                        <div className="deep-feed-container deep-feed-drag-overlay">
                                            <div className="channel-link deep-feed-header">
                                                <p style={{ margin: "0" }}>{activeDragItem.name}</p>
                                            </div>
                                        </div>
                                    )}
                                {activeId &&
                                    activeDragItem &&
                                    dragType === "feedInDeepFeed" && (
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
                                {activeId &&
                                    activeDragItem &&
                                    dragType === "nestedDeepFeed" && (
                                        <div className="deep-feed-container deep-feed-drag-overlay">
                                            <div className="channel-link deep-feed-header">
                                                <p style={{ margin: "0" }}>
                                                    {activeDragItem.nestedDeepFeed.name}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                            </DragOverlay>*/}
                        {/*</DndContext>*/}</>
                    ) : (
                        <div style={{ marginTop: "64px" }}>
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
                    )}
                </aside>
                <main>
                    <header className="base-header">
                        <button className="small-icon" onClick={toggleLeft} title={desk.left ? "Open sidebar" : "Close sidebar"}>
                            {(isMobile() && mobileOpen === "left") ||
                            (!isMobile() && !desk.left) ? (
                                <FaTimes />
                            ) : (
                                <FaBars />
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
                                <button className="icon-button search" data-tooltip="Search" type="submit">
                                    <MagnifyingGlassIcon className="standard-icon" style={{ transform: "scale(1.3)" }}/>
                                </button>
                            </div>
                        </form>
                        {headerErrorMessage && (
                            <p className="error-message">{headerErrorMessage}</p>
                        )}
                        <button className="small-icon" onClick={toggleRight} title={desk.right ? "Open sidebar" : "Close sidebar"}>
                            {(isMobile() && mobileOpen === "right") ||
                            (!isMobile() && !desk.right) ? (
                                <FaTimes />
                            ) : (
                                <FaBars />
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