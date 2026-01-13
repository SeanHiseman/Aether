import api from "../../api";
import { AuthContext } from "../../components/authContext";
import Cropper from "react-easy-crop";
import { Crown } from 'lucide-react';
import DeepFeedItem from "../../components/channels/deepFeedItem";
import { DndContext, PointerSensor, pointerWithin, rectIntersection, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { FaArrowRight, FaCog, FaFileUpload, FaMinus, FaPen, FaPlus, FaPlusCircle, FaSignInAlt } from "react-icons/fa";
import { FcGoogle } from 'react-icons/fc';
import FeedItem from "../../components/channels/feedItem";
import GetCroppedImg from "../../functions/getCroppedImg";
import InputModal from "../../components/modals/inputModal";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import SocialFeedLink from "../../socialConnect/socialFeedLink";
import SwipeableAside from "../../components/swipeableAside";
import { ThemeContext } from "../../themeProvider";
import { Tooltip } from "react-tooltip";
import { UnreadContext } from "../../components/messages/unreadContext";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ValidateTextInput } from "../../functions/validateTextInput";
import { v4 } from "uuid";
import "../../css/algorithms.css";
import "../../css/baseLayout.css";
import "../../css/basicStyles.css";
import "../../css/contentFeed.css";
import "../../css/contentForm.css";
import "../../css/feed.css";
import "../../css/membership.css";
import "../../css/messages.css";
import "../../css/output.css";

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
    const [dragged, setDragged] = useState(false);
	const [dragType, setDragType] = useState(null);
	const [feed, setFeed] = useState([]);
	const feedContainerRef = useRef(null);
    const [feedLimitReached, setFeedLimitReached] = useState(false);
	const [feedName, setFeedName] = useState("");
	const [feedPhotoFile, setFeedPhotoFile] = useState(null);
	const [feedType, setFeedType] = useState("public");
	const [feeds, setFeeds] = useState([]);
	const [headerErrorMessage, setHeaderErrorMessage] = useState("");
	const [imageSrc, setImageSrc] = useState(null);   
    const [isFeedNameValid, setIsFeedNameValid] = useState(true); 
    const location = useLocation();
	const [mobileOpen, setMobileOpen] = useState(null);
    const [nameModalOpen, setNameModalOpen] = useState(false);
    const navigate = useNavigate();
    const [pendingDeepFeed, setPendingDeepFeed] = useState(null);
	const [showForm, setShowForm] = useState(false);
	const [zoom, setZoom] = useState(1);
	const { isAuthenticated, user, viewer } = useContext(AuthContext);
	const { setTheme } = useContext(ThemeContext);
	const { state } = useContext(UnreadContext);
	const hasMembership = user?.has_membership;
	const MAX_FILE_SIZE = hasMembership ? 500 * 1024 * 1024 : 5 * 1024 * 1024; //500MB for members, 5MB for non-members
    const sensors = useSensors(
        useSensor(PointerSensor, { 
            activationConstraint: { distance: 8 } 
        }),
        useSensor(TouchSensor, { 
            activationConstraint: { 
                delay: 250,    //Wait 250ms before starting drag (prevents scroll conflicts)
                tolerance: 5   //Allow 5px movement during the delay period
            } 
        })
    );

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const toggleLeft = () => { 
        if (isMobile()) setMobileOpen(mobileOpen === "left" ? null : "left"); 
        else setDesk(d => ({ ...d, left: !d.left })); 
    };
    
    const toggleRight = () => { 
        if (isMobile()) setMobileOpen(mobileOpen === "right" ? null : "right"); 
        else setDesk(d => ({ ...d, right: !d.right })); 
    };
    
    const closeDrawers = () => setMobileOpen(null);

    //Classes without the swipe-related classes (SwipeableAside handles those)
    const contentClasses = [
        "content", 
        desk.left ? "hide-left" : "", 
        desk.right ? "hide-right" : "", 
        isMobile() && mobileOpen === "left" ? "shift-right" : ""
    ].filter(Boolean).join(" ");

    const leftClasses = [
        "left-aside", 
        desk.left ? "collapsed" : "", 
        isMobile() && mobileOpen === "left" ? "open" : ""
    ].filter(Boolean).join(" ");

    const rightClasses = [
        "right-aside", 
        desk.right ? "collapsed" : "", 
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

    const customCollisionDetection = useCallback((args) => {
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) {
            return pointerCollisions;
        }
        return rectIntersection(args);
    }, []);

    const dragStart = event => {
        setDragged(true);
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
                    //Get cached contents
                    let cachedContents = JSON.parse(
                        localStorage.getItem(`deepFeedContents_${targetDeepFeedId}`)
                    ) || [];
                    //If cache is empty, fetch from API first
                    if (cachedContents.length === 0) {
                        try {
                            const { data } = await api.get(`/deep_feed_contents/${targetDeepFeedId}`);
                            cachedContents = data?.contents || [];
                            localStorage.setItem(
                                `deepFeedContents_${targetDeepFeedId}`,
                                JSON.stringify(cachedContents)
                            );
                        } catch (fetchError) {
                            console.error("Error fetching deep feed contents:", fetchError);
                        }
                    }
                    //Check for duplicate
                    const alreadyExists = cachedContents.some(
                        item => item?.feed?.feed_id === sourceFeed?.feed_id
                    );
                    if (alreadyExists) {
                        setAsideErrorMessage("This feed is already in the combined feed");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                        resetDragState();
                        return;
                    }
                    const payload = {
                        deepFeedId: targetDeepFeedId,
                        feedId: sourceFeed?.feed_id
                    };
                    const { data } = await api.post("/add_to_deep_feed", payload);
                    if (data.success && deepFeedCallbacks[targetDeepFeedId]) {
                        deepFeedCallbacks[targetDeepFeedId]({ type: "UPDATE_CONTENTS" });
                    }
                    window.dispatchEvent(new CustomEvent('deepFeedUpdated', { 
                        detail: { deepFeedId: targetDeepFeedId } 
                    }));
                }
            }
            //Case 2: Two regular feeds from sidebar combine to create new deep feed
            else if (dragType === "feed" && !isOverDeepFeed && targetFeedId) {
                const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds") || "[]");
                if (storedDeepFeeds.length === (hasMembership ? 500 : 5)) { //Members get more combined feeds
                    setFeedLimitReached(true);
                    setTimeout(() => setFeedLimitReached(false), 20000);
                } else {
                    const sourceFeed = activeDragItem;
                    const targetFeed = feeds.find(f => f?.feed_id.toString() === targetFeedId);
                    if (sourceFeed && targetFeed && sourceFeed?.feed_id !== targetFeed?.feed_id) {
                        setPendingDeepFeed({ sourceFeed, targetFeed });
                        setNameModalOpen(true);
                    }
                }
            }
            setTimeout(() => setDragged(false), 0);
            } catch (error) {
                setAsideErrorMessage(error.response?.data?.message || "Error in drag operation");
                setTimeout(() => setAsideErrorMessage(""), 5000);
            }
        setTimeout(() => setDragged(false), 0);
        resetDragState();
    };

    const handleGoogleLogin = () => {
        sessionStorage.setItem('authRedirectPath', location.pathname);
        window.location.href = `${window.location.origin}/api/auth/google`;
    };

    const nameModalConfirm = async (deepFeedName) => {
        if (!pendingDeepFeed) return;
        const { sourceFeed, targetFeed } = pendingDeepFeed;
        try {
            const payload = {
                viewerId: viewer?.feed_id,
                deepFeedName,
                feedsToInclude: [sourceFeed?.feed_id, targetFeed?.feed_id]
            };
            const { data } = await api.post("/create_deep_feed", payload);
            if (data.success && data?.deepFeed) {
                const newDeepFeed = {
                    ...data.deepFeed,
                    feeds: data.feedsToInclude.map(id => ({ 
                        feed: feeds.find(f => f?.feed_id === id) 
                    }))
                };
                const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds") || "[]");
                storedDeepFeeds.push(newDeepFeed);
                localStorage.setItem("deepFeeds", JSON.stringify(storedDeepFeeds));
                updateFeeds();
            }
        } catch (error) {
            setAsideErrorMessage(error.response?.data?.message || "Error creating deep feed");
            setTimeout(() => setAsideErrorMessage(""), 5000);
        }
        setNameModalOpen(false);
        setPendingDeepFeed(null);
    };

    const nameModalCancel = () => {
        setNameModalOpen(false);
        setPendingDeepFeed(null);
    };

    const resetDragState = () => {
        setActiveId(null);
        setActiveDragItem(null);
        setDragType(null);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('error') === 'auth_failed') {
            setAsideErrorMessage('Google authentication failed. Please try again.');
        }
    }, [location]);

    useEffect(() => {
        if (!isAuthenticated || !viewer?.feed_id) {
            return;
        }
        (async () => {
            try {
                //Feed info of logged in user
                const userFeed = JSON.parse(localStorage.getItem("user")) || [];
                setFeed(userFeed);
                const storedFeeds = JSON.parse(localStorage.getItem("followedFeeds")) || [];
                setFeeds(storedFeeds.sort((a, b) =>
                    a?.feed_name?.localeCompare(b?.feed_name)
                ));
                const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds")) || [];
                setDeepFeeds(storedDeepFeeds);
            }
            catch (error) {
                setDeepFeeds([]);
                setFeeds([]);
            }
        })();
    }, [isAuthenticated, viewer?.feed_id]);

    const registerFeedCallback = useCallback((deepFeedId, callback) => {
        setDeepFeedCallbacks(prev => ({ ...prev, [deepFeedId]: callback }));
    }, []);

    //Ask assistant temporarily deactivated
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
                if (user?.has_membership) {
                    await api.post("/create_ask_chat", {
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
            form.append("feedOwner", user?.user_id);
            form.append("viewerFeedId", viewer?.feed_id);
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
            const response = await api.post("/create_feed", form, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (response.data?.success) {
                const created = response.data?.feed;
                const newFeed = {
                    feed_id: created?.feed_id,
                    feed_name: created?.feed_name,
                    feed_photo: created?.feed_photo,
                    link_type: "g"
                };
                const followedFeeds = JSON.parse(localStorage.getItem("followedFeeds") || "[]");
                const updated = [...followedFeeds, newFeed];
                localStorage.setItem("followedFeeds", JSON.stringify(updated));
                updateFeeds();
                setFeedName("");
                setShowForm(false);
                setFeedPhotoFile(null);
                setImageSrc(null);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCroppedAreaPixels(null);
                navigate(`/g/${created?.feed_name}`);
            }
        }
        catch (error) {
            if (error.response?.status === 413) {
                setAsideErrorMessage(
                    (error.response?.data?.message || "File too large") +
                    (!user?.has_membership ? ". Get membership for more" : "")
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
            const allowedTypes = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
            if (!allowedTypes.includes(file.type)) {
                setAsideErrorMessage('Please upload a valid image file (JPEG, PNG, GIF, WebP, or BMP)');
                event.target.value = '';
                return;
            }
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
        if (currentQuery.trim().length !== 0) {
            navigate(`/search?keyword=${currentQuery}`);
        } else {
            return;
        }
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

    const updateFeeds = useCallback(() => {
        try {
            const storedFeeds = JSON.parse(localStorage.getItem("followedFeeds")) || [];
            const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds")) || [];
            const storedUser = JSON.parse(localStorage.getItem("user")) || [];
            const deepFeedsWithContents = storedDeepFeeds.map(df => {
                const cachedContents = JSON.parse(
                    localStorage.getItem(`deepFeedContents_${df?.deep_feed_id}`)
                ) || [];
                return {
                    ...df,
                    feeds: cachedContents, 
                };
            });
            setFeeds(storedFeeds.sort((a, b) => 
                a?.feed_name.localeCompare(b?.feed_name)
            ));
            setDeepFeeds(deepFeedsWithContents);
            setFeed(storedUser);
        } catch (error) {
            setAsideErrorMessage(error.response?.data?.message || "Error updating feeds");
            setFeeds([]);
            setDeepFeeds([]);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            localStorage.clear();
        }
    }, [isAuthenticated]);

    return (
        <>
            {mobileOpen && (
                <div className="backdrop" onClick={closeDrawers} />
            )}
            <div className="container">
                <SwipeableAside className={leftClasses} position="left"isOpen={mobileOpen === "left"} onClose={closeDrawers} forwardedRef={feedContainerRef}>
                    {isAuthenticated ? (
                        <>
                            <div className="left-aside-feed-info">
                                <Link className="feed-link" to={`/u/${feed?.feed_name}`}>
                                    <img className="small-feed-photo" src={`${feed?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                                    <p className="feed-list-text">{feed?.feed_name}</p>
                                </Link>
                                <Link className="small-icon" to={`/settings/${feed?.feed_name}`} title="Settings">
                                    <FaCog />
                                </Link>
                            </div>
                            <div className="text-left w-90">
                                <Link to="/help">
                                    <p className="small-text faded-text underline">Help</p>
                                </Link>
                                <Link to="/feedback">
                                    <p className="small-text faded-text underline">Give feedback</p>
                                </Link>
                            </div>
                            <div className="post-button-container">
                                <Link className="main-button" to={`/u/${viewer?.feed_name}/Main/create`} title="Create Post">
                                    <FaPen />
                                    <p className="icon-text">Create post</p>
                                </Link>
                            </div>
                            <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragStart={dragStart} onDragEnd={dragEnd}>
                                <nav id="personal-feeds">
                                    <ul>
                                        <Link to="/messages">
                                            <div className={`channel-link ${location.pathname.startsWith('/messages') ? 'selected' : ''}`}>
                                                Messages
                                                {state.total > 0 && <span className="unread-count">{state.total}</span>}
                                            </div>
                                        </Link>
                                        <Link to="/explore" className={`channel-link ${location.pathname.startsWith('/explore') ? 'selected' : ''}`}>
                                            Explore
                                        </Link>
                                        <Link to="/d/following" className={`channel-link ${location.pathname.startsWith('/d/following') ? 'selected' : ''}`}>
                                            Following
                                        </Link>
                                        <Link to="/saved/Main" className={`channel-link ${location.pathname.startsWith('/saved') ? 'selected' : ''}`}>
                                            Saved posts
                                        </Link>
                                    </ul>
                                </nav>
                                <div className="deep-feeds-container">
                                    {deepFeeds?.map(deepFeed => (
                                        <DeepFeedItem key={deepFeed?.deep_feed_id} deepFeed={deepFeed} onFeedAdded={registerFeedCallback} showHeader={true} />
                                    ))}
                                </div>
                                {feedLimitReached && (
                                <Link className="small-icon" to={`/settings/${user?.username}/membership`} type="button" style={{ marginLeft: '5px' }} title="View Membership">
                                        <Crown />
                                        <p className="icon-text">Get membership for more</p>
                                    </Link>
                                )}
                                <p className="tiny-text faded-text">{asideErrorMessage}</p>
                                <div id="create-feed-section">
                                    <button className="small-icon" onClick={toggleForm} style={{ alignSelf: "flex-start", marginLeft: "calc(5% + 10px)" }}>
                                        {showForm ? (
                                            <>
                                                <FaMinus />
                                                <p className="icon-text">Close</p>
                                            </>
                                        ) : (
                                            <>
                                                <FaPlusCircle />
                                                <p className="icon-text">Create Group Feed</p>
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
                                                    if (input.length <= 30) {
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
                                                    } else {
                                                        setAsideErrorMessage("Feed name too long");
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
                                                <p className="small-text faded-text">
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
                                    <p className="small-text faded-text">Drag and drop to combine feeds</p>
                                    <ul className="feeds-list">
                                        {JSON.parse(localStorage.getItem("connectedAccounts") || "[]")?.some(a => a.platform === "reddit") && (
                                            <SocialFeedLink logo="/media/site_images/social_sites/reddit-logo.png" name="Reddit" slug="reddit" />
                                        )}
                                        {JSON.parse(localStorage.getItem("connectedAccounts") || "[]")?.some(a => a.platform === "bluesky") && (
                                            <SocialFeedLink logo="/media/site_images/social_sites/bluesky-logo.png" name="Bluesky" slug="bluesky" />
                                        )}
                                        {JSON.parse(localStorage.getItem("connectedAccounts") || "[]")?.some(a => a.platform === "mastodon") && (
                                            <SocialFeedLink logo="/media/site_images/social_sites/mastodon-logo.png" name="Mastodon" slug="mastodon" />
                                        )}
                                        {feeds?.map(feed => (
                                            <FeedItem key={feed?.feed_id} dragged={true} feed={feed} isChat={false} />
                                        ))}
                                    </ul>
                                </nav>
                            </DndContext>
                        </>
                    ) : (
                        <div style={{ alignItems: "center", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "80%" }}>
                            <Link to="/welcome">
                                <p className="large-text faded-text" style={{ fontWeight: '700' }}>Aether</p>
                                <p className="large-text faded-text" style={{ fontWeight: '700' }}>Social</p>
                            </Link>
                            <p className="small-text faded-text" style={{ fontWeight: '500', textAlign: 'center' }}>Social media you control</p>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                <button type="button" onClick={handleGoogleLogin} className="google-oauth-button">
                                    <FcGoogle size={20} />
                                    <span>Google login</span>
                                </button>
                                <div className="divider-container">
                                    <div className="divider-line" />
                                    <span className="divider-text">or</span>
                                    <div className="divider-line" />
                                </div>
                                <Link to="/join" className="large-icon">
                                    <FaArrowRight />
                                    <p className="icon-text">Join</p>
                                </Link>
                                <button className="large-icon" onClick={() => navigate("/login", { state: { from: location.pathname } })} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                    <FaSignInAlt />
                                    <p className="icon-text">Login</p>
                                </button>
                                <p className="faded-text" style={{ marginTop: "20px" }}>
                                    Join or login for more
                                </p>
                            </div>
                            <div />
                        </div>
                    )}
                </SwipeableAside>
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
                        <Outlet context={{ rightClasses, updateFeeds, closeDrawers, mobileOpen }} />
                    </div>
                </main>
            </div>
            <InputModal isOpen={nameModalOpen} onConfirm={nameModalConfirm} onCancel={nameModalCancel} title={pendingDeepFeed ? 
                    `Combine ${pendingDeepFeed.sourceFeed?.feed_name} and ${pendingDeepFeed.targetFeed?.feed_name}` : 
                    'Name your combined feed'
                } 
                placeholder="Enter combined feed name..."
            />
            {!isAuthenticated && mobileOpen !== "left" && (
                <footer className="mobile-auth-footer">
                    <button type="button" onClick={handleGoogleLogin} className="google-oauth-button">
                        <FcGoogle size={20} />
                        <span>Google</span>
                    </button>
                    <Link to="/join" className="large-icon">
                        <FaArrowRight />
                        <p className="icon-text">Join</p>
                    </Link>
                    <button 
                        className="large-icon" 
                        onClick={() => navigate("/login", { state: { from: location.pathname } })}
                        style={{ background: "none", border: "none", cursor: "pointer" }}
                    >
                        <FaSignInAlt />
                        <p className="icon-text">Login</p>
                    </button>
                </footer>
            )}
        </>
    );
};

export default BaseLayout;