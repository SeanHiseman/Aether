import AlgorithmSelector from '../algorithms/algorithmSelector';
import api from '../api';
import { AuthContext } from '../components/authContext';
import ConfirmModal from '../components/modals/confirmModal';
import ContentWidget from '../components/content/contentWidget';
import ExternalPostWidget from '../socialConnect/externalPostWidget';
import { FaEdit, FaGlobe, FaHome, FaMinus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import FeedItem from '../components/channels/feedItem';
import PlatformConnect from '../socialConnect/platformConnect';
import SwipeableAside from '../components/swipeableAside';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ValidateTextInput } from '../functions/validateTextInput';

const FETCH_LIMIT = 100;

//Handles combined feeds, as well as the following feed (which can include external posts)
const DeepFeed = () => {
    const { isAuthenticated } = useContext(AuthContext);
    const [connectedPlatforms, setConnectedPlatforms] = useState(() => {
        const accounts = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
        return Object.keys(accounts);
    });
    const [contents, setContents] = useState([]);
    const { deep_feed_id } = useParams();
    const isFollowing = deep_feed_id === 'following' ? true : false;
    const [deepFeed, setDeepFeed] = useState(() => {
        if (isFollowing) {
            return { deep_feed_id: 'following', name: 'Following', owner_id: 'system', parent_id: null };
        }
        const stored = JSON.parse(localStorage.getItem("deepFeeds") || "[]");
        const match = stored.find(df => df.deep_feed_id === deep_feed_id);
        return match || { deep_feed_id, name: '', owner_id: null, parent_id: null };
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [hasConnectedAccounts, setHasConnectedAccounts] = useState(() => {
        const accounts = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
        return Object.keys(accounts).length > 0;
    });
    const [includeExternal, setIncludeExternal] = useState(true);
    const [includeNative, setIncludeNative] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isNewNameValid, setIsNewNameValid] = useState(false);
    const [newName, setNewName] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    const scrollRef = useRef(null);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

    useEffect(() => {
        if (!deep_feed_id || isFollowing) return;
        const fetchContents = async () => {
            try {
                const { data } = await api.get(`/deep_feed_contents/${deep_feed_id}`);
                const fetched = data?.contents || [];
                setContents(fetched);
                localStorage.setItem(`deepFeedContents_${deep_feed_id}`, JSON.stringify(fetched));
            } catch (error) {
                const cached = localStorage.getItem(`deepFeedContents_${deep_feed_id}`);
                if (cached) {
                    setContents(JSON.parse(cached));
                } else {
                    setErrorMessage(error.response?.data?.message || 'Failed to load contents.');
                    setContents([]);
                }
                setTimeout(() => setErrorMessage(''), 5000);
            }
        };
        fetchContents();
    }, [deep_feed_id]);

    const sortedContents = [...contents].sort((a, b) =>
        (a?.feed?.feed_name || '').localeCompare(b?.feed?.feed_name || '')
    );

    const cancelDelete = () => { setShowDeleteConfirm(false) };

    const confirmDelete = async () => {
        setShowDeleteConfirm(false);
        try {
            if (deepFeed?.name === 'Following') {
                setErrorMessage("Following cannot be deleted.");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            const response = await api.delete('/delete_deep_feed', { data: { deepFeedId: deep_feed_id } });
            if (response.data?.success) {
                setDeepFeed((prev) => {
                    const updated = { name: 'Following' };
                    for (const key in prev) {
                        if (key !== 'name') {
                            updated[key] = null;
                        }
                    }
                    return updated;
                });                    
                setErrorMessage('');
                const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds") || "[]");
                const updatedDeepFeeds = storedDeepFeeds.filter(df => df.deep_feed_id !== deep_feed_id);
                localStorage.setItem("deepFeeds", JSON.stringify(updatedDeepFeeds));
                updateFeeds();
                navigate('/explore');
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error deleting combined feed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const deleteClick = () => { setShowDeleteConfirm(true) };

    const changeDeepFeedName = async (event) => {
        event.preventDefault();
        if (isFollowing) return;
        try {
            const response = await api.post('/change_deep_feed_name', {
                deepFeedId: deep_feed_id,
                newName
            });
            if (response?.status === 200) {
                setErrorMessage('');
                setIsEditingName(false);
                setNewName('');
                setDeepFeed((prev) => ({ ...prev, name: newName }));
                document.title = newName;
                const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds") || "[]");
                const updatedDeepFeeds = storedDeepFeeds.map(df =>
                    df.deep_feed_id === deep_feed_id ? { ...df, name: newName } : df
                );
                localStorage.setItem("deepFeeds", JSON.stringify(updatedDeepFeeds));
                updateFeeds();
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Error changing name");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const getPosts = async ({ pageParam = 0 }) => {
        try {
            let followedFeedIds;
            let normalisedDeepFeedId = deep_feed_id;
            if (deep_feed_id !== 'following' && !deep_feed_id.startsWith('deep_')) {
                normalisedDeepFeedId = `deep_${deep_feed_id}`;
            }
            if (deep_feed_id === 'following') {
                const followedFeeds = JSON.parse(localStorage.getItem("followedFeeds") || "[]");
                followedFeedIds = followedFeeds.map(f => f.feed_id);
            } else {
                followedFeedIds = [];
            }
            const recentUpvotes = JSON.parse(localStorage.getItem("recentUpvotes") || "[]");
            const connectedAccounts = deep_feed_id === 'following' ? JSON.parse(localStorage.getItem("connectedAccounts") || "[]") : [];
            const response = await api.post('/deep_feed_posts', {
                connectedAccounts,
                deepFeedId: normalisedDeepFeedId,
                followedFeedIds: followedFeedIds,
                limit: FETCH_LIMIT,
                offset: pageParam, 
                recentUpvotes
            });
            if (pageParam === 0 && response.data?.deepFeed) {
                setDeepFeed(response.data?.deepFeed);
                document.title = response.data?.deepFeed?.name;
            } else if (deep_feed_id === 'following') {
                setDeepFeed({
                    deep_feed_id: 'following',
                    name: 'Following',
                    owner_id: 'system',
                    parent_id: null,
                });
                document.title = 'Following';
            }
            const posts = Array.isArray(response.data?.posts) ? response.data.posts : [];
            const status = response.data?.status;
            const message = response.data?.message;
            if (pageParam === 0 && message) {
                setErrorMessage(message);
            }
            return posts;
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error fetching posts');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return [];
        }
    };

    useEffect(() => {
        const handleAccountsChange = () => {
            const accounts = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
            const platforms = accounts.map(a => a.platform);
            setHasConnectedAccounts(platforms.length > 0);
            setConnectedPlatforms(platforms);
            queryClient.removeQueries(['deepFeedPosts', deep_feed_id]);
        };
        window.addEventListener('connectedAccountsUpdated', handleAccountsChange);
        return () => window.removeEventListener('connectedAccountsUpdated', handleAccountsChange);
    }, [deep_feed_id, queryClient]);

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, status } = useInfiniteQuery({
        queryKey: ['deepFeedPosts', deep_feed_id],
        queryFn: getPosts,
        getNextPageParam: (lastPage, allPages) => {
            if (!Array.isArray(lastPage)) {
                return undefined;
            }
            //Only stop when 0 posts
            if (lastPage.length === 0) {
                return undefined;
            }
            const nextOffset = allPages.length * FETCH_LIMIT;
            return nextOffset;
        },
        refetchOnWindowFocus: false, //Don't refetch when clicking back to window
        refetchOnReconnect: false, //Don't refetch on network reconnect
    });

    const removeFeed = async (feedId) => {
        try {
            const response = await api.post('/remove_from_deep_feed', {
                deepFeedId: deep_feed_id,
                feedId
            });
            if (response.data?.success) {
                const updated = contents.filter(item => item?.feed?.feed_id !== feedId);
                setContents(updated);
                localStorage.setItem(
                    `deepFeedContents_${deep_feed_id}`,
                    JSON.stringify(updated)
                );
                const storedDeepFeeds = JSON.parse(localStorage.getItem("deepFeeds") || "[]");
                const updatedDeepFeeds = storedDeepFeeds.map(df => {
                    if (df.deep_feed_id === deep_feed_id) {
                        return {
                            ...df,
                            feeds: updated
                        };
                    }
                    return df;
                });
                localStorage.setItem("deepFeeds", JSON.stringify(updatedDeepFeeds));
                window.dispatchEvent(new CustomEvent('deepFeedUpdated', { 
                    detail: { deepFeedId: deep_feed_id } 
                }));
            } else {
                setErrorMessage('Failed to remove feed');
                setTimeout(() => setErrorMessage(''), 5000);
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error removing feed');
            setTimeout(() => setErrorMessage(''), 5000);
        }
    };

    useEffect(() => {
        const handleUpdate = async (event) => {
            if (event.detail.deepFeedId === deep_feed_id) {
                try {
                    const { data } = await api.get(`/deep_feed_contents/${deep_feed_id}`);
                    const fetched = data?.contents || [];
                    setContents(fetched);
                    localStorage.setItem(`deepFeedContents_${deep_feed_id}`, JSON.stringify(fetched));
                    queryClient.invalidateQueries(['deepFeedPosts', deep_feed_id]);
                } catch (error) {
                    const cached = localStorage.getItem(`deepFeedContents_${deep_feed_id}`);
                    if (cached) {
                        setContents(JSON.parse(cached));
                    }
                }
            }
        };
        window.addEventListener('deepFeedUpdated', handleUpdate);
        return () => window.removeEventListener('deepFeedUpdated', handleUpdate);
    }, [deep_feed_id, queryClient]);

    //Filter native/external and prevent duplicate posts
    const allPosts = Array.isArray(data?.pages)
        ? data.pages
            .flatMap(page => Array.isArray(page) ? page : [])
            .filter((p, index, self) =>
                self.findIndex(post => post.post_id === p.post_id) === index
            )
            .filter(post => {
                if (!post?.platform) return true;
                if (!post.is_external) return true;
                return connectedPlatforms.includes(post.platform);
            })
        : [];

    const visiblePosts = allPosts.filter(p =>
        (includeNative && !p.is_external) ||
        (includeExternal && p.is_external)
    );

    const handleScroll = useCallback(() => {
        const element = scrollRef.current;
        if (!element || isFetchingNextPage || !hasNextPage) {
            return;
        }
        const totalHeight = element.scrollHeight;
        const scrolledDistance = element.scrollTop;
        const visibleHeight = element.clientHeight;
        const distanceRemaining = totalHeight - scrolledDistance - visibleHeight;
        const threshold = window.innerHeight * 1.5;
        if (distanceRemaining <= threshold) {
            fetchNextPage();
        }
    }, [fetchNextPage, isFetchingNextPage, hasNextPage]);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        const scrollHandler = () => {
            handleScroll();
        };
        element.addEventListener('scroll', scrollHandler);
        return () => element.removeEventListener('scroll', scrollHandler);
    }, [handleScroll]);

    const refreshPosts = () => {
        setErrorMessage('');
        setRefreshTrigger(!refreshTrigger);
    };

    //Refresh posts upon algorithm change
    useEffect(() => {
        if (refreshTrigger !== undefined) {
            queryClient.invalidateQueries(['deepFeedPosts', deep_feed_id]);
        }
    }, [refreshTrigger, queryClient, deep_feed_id]);

    document.title = deepFeed?.name || 'Combined feed';
    return (
        <><div className="standard-container">
            <div ref={scrollRef} className="channel-feed">
                {isLoading ? (
                    <p className="large-text faded-text">Loading posts...</p>
                ) : allPosts.length > 0 && visiblePosts.length === 0 ? (
                    <p className="large-text faded-text">All posts hidden</p>
                ) : visiblePosts.length > 0 ? (
                    <div className="flex flex-col w-99">
                        {visiblePosts.map((post) => (
                            post ? (
                                <div key={post?.post_id || Math.random()} className="bg-gray-800 rounded-xl">
                                    {post.is_external ? (
                                        <ExternalPostWidget post={post} />
                                    ) : (
                                        <ContentWidget post={post} />
                                    )}
                                </div>
                            ) : null
                        ))}
                        {isFetchingNextPage && (
                            <div className="flex justify-center py-4">
                                <p className="large-text faded-text">Loading more posts...</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="large-text faded-text">No posts yet</p>
                )}
            </div>
            <SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
                <div className="channel-name-section">
                    {isEditingName ? (
                        <div className="change-name">
                            <textarea
                                className="change-name-area"
                                onChange={(e) => {
                                    const input = e.target.value;
                                    setNewName(input);
                                    if (input) {
                                        if (input.trim() === 'following') {
                                            setErrorMessage("Cannot be named 'Following'");
                                        } else {
                                            const result = ValidateTextInput(input, 1, 30);
                                            if (result.valid) {
                                                setErrorMessage("");
                                                setIsNewNameValid(true);
                                            } else {
                                                setErrorMessage(result.error);
                                                setIsNewNameValid(true);
                                            }
                                        }
                                    } else {
                                        setErrorMessage("");
                                        setIsNewNameValid(true);
                                    }
                                } }
                                placeholder="New name"
                                value={newName} />
                            <div className="cancel-save">
                                <button className="small-icon" onClick={() => { setIsEditingName(false); setNewName(""); setErrorMessage(""); } } title="Cancel">
                                    <FaRegWindowClose />
                                </button>
                                <button className={!isNewNameValid ? "small-icon disabled" : "small-icon"} onClick={changeDeepFeedName} title="Save">
                                    <FaSave />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name">
                            <p className="large-text bold">{deepFeed?.name}</p>
                            <div className="button-group">
                                {deepFeed?.name !== "Following" && (
                                    <>
                                        <button
                                            className="small-icon"
                                            onClick={() => {
                                                setIsEditingName(true);
                                                setNewName(deepFeed?.name);
                                            } }
                                            title="Edit name"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button className="small-icon" onClick={deleteClick} title="Delete Combined Feed">
                                            <FaTrash />
                                        </button>
                                    </>
                                )}
                            </div>
                            <AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={deepFeed?.deep_feed_id} refreshPosts={refreshPosts} />
                        </div>
                    )}
                    <div className="small-text faded-text">{errorMessage}</div>
                    {isFollowing && hasConnectedAccounts && <div className="flex flex-col items-flex-start">
                        <button onClick={() => setIncludeNative(!includeNative)} className="small-icon">
                            <FaHome />
                            <p className="icon-text">{includeNative ? "Hide native" : "Show native"}</p>
                        </button>
                        <button onClick={() => setIncludeExternal(!includeExternal)} className="small-icon">
                            <FaGlobe />
                            <p className="icon-text">{includeExternal ? "Hide external" : "Show external"}</p>
                        </button>
                    </div>}
                    {sortedContents.length > 0 && (
                        <ul className="feed-list">
                            {sortedContents.map(item => (
                                <li key={item?.feed?.feed_id} style={{ display: 'flex', alignItems: 'center' }}>
                                    <button className="small-icon" onClick={() => removeFeed(item?.feed?.feed_id)} title="Remove from combined feed">
                                        <FaMinus />
                                    </button>
                                    <FeedItem id={item?.feed?.feed_id.toString()} feed={item?.feed} isChat={false} parentDeepFeedId={deep_feed_id} />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {isAuthenticated && isFollowing && (
                    <PlatformConnect />
                )}
            </SwipeableAside>
        </div>
        <ConfirmModal isOpen={showDeleteConfirm} onConfirm={confirmDelete} onCancel={cancelDelete} title={`Delete ${deepFeed?.name}`} message={`Are you sure you want to delete ${deepFeed?.name}?`} /></>
    );
}

export default DeepFeed;