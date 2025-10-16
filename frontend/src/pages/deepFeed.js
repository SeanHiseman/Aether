import api from "../api";
import AlgorithmSelector from '../algorithms/algorithmSelector';
import { useContext, useEffect, useRef, useState } from 'react';
import { FaEdit, FaMinus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AuthContext } from '../components/authContext';
import ConfirmModal from '../components/modals/confirmModal';
import ContentWidget from '../components/content/contentWidget';
import FeedItem from '../components/channels/feedItem';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ValidateTextInput } from '../functions/validateTextInput';
import { set } from 'date-fns';

const DeepFeed = () => {
    const { isAuthenticated } = useContext(AuthContext);
    const [contents, setContents] = useState([]);
    const { deep_feed_id } = useParams();
    const [deepFeed, setDeepFeed] = useState({ deep_feed_id: null, name: '', owner_id: null, parent_id: null });
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isNewNameValid, setIsNewNameValid] = useState(false);
    const [newName, setNewName] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    const loaderRef = useRef(null);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { rightClasses, updateFeeds } = useOutletContext(); 
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (!deep_feed_id) return;
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
                    setErrorMessage(error.response.data?.message || 'Failed to load contents.');
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
            setErrorMessage(error.response.data?.message || 'Error deleting combined feed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const deleteClick = () => { setShowDeleteConfirm(true) };

    const changeDeepFeedName = async (event) => {
        event.preventDefault();
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
            setErrorMessage(error.response.data?.message || "Error changing name");
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
            const response = await api.get('/deep_feed_posts', {
                params: {
                    deepFeedId: normalisedDeepFeedId,
                    followedFeedIds: followedFeedIds,
                    limit: 48,
                    offset: pageParam, 
                    recentUpvotes
                }
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
            return response.data?.posts;
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error fetching posts');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return [];
        }
    };

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, status } = useInfiniteQuery({
        queryKey: ['deepFeedPosts', deep_feed_id],
        queryFn: getPosts,
        getNextPageParam: (lastPage, allPages) => {
            if (!Array.isArray(lastPage)) return undefined;
            return lastPage.length === 10 ? allPages.length * 10 : undefined;
        }
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
            setErrorMessage(error.response.data?.message || 'Error removing feed');
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
                    console.error('Error fetching updated contents:', error);
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

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        });
        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }
        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [loaderRef, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const allPosts = Array.isArray(data?.pages) ? data.pages.flatMap(page => Array.isArray(page) ? page : []) : [];

    const refreshPosts = () => {
        setRefreshTrigger(!refreshTrigger);
    };

    //Refresh posts upon algorithm change
    useEffect(() => {
        if (refreshTrigger === false) return;
        queryClient.invalidateQueries(['deepFeedPosts', deep_feed_id]);
        queryClient.refetchQueries(['deepFeedPosts', deep_feed_id]);
    }, [refreshTrigger, queryClient, deep_feed_id]);

    return (
        <><div className="standard-container">
            <div className="channel-feed">
                <div className="channel-content">
                    {allPosts.length > 0 ? (
                        <>
                            <ul className="content-list">
                                {allPosts.map((post) => (
                                    post ? (
                                        <ContentWidget key={post?.post_id || Math.random()} post={post} />
                                    ) : null
                                ))}
                            </ul>
                            <div ref={loaderRef}>
                                {isFetchingNextPage && <p className="large-text faded-text">Loading more posts...</p>}
                            </div>
                        </>
                    ) : (
                        !isLoading && <p className="large-text faded-text">No posts yet</p>
                    )}
                </div>
            </div>
            <aside className={rightClasses}>
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
                            {isAuthenticated && <AlgorithmSelector locationId={deepFeed?.deep_feed_id} refreshPosts={refreshPosts} />}
                        </div>
                    )}
                    <div className="small-text faded-text">{errorMessage}</div>
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
            </aside>
        </div>
        <ConfirmModal isOpen={showDeleteConfirm} onConfirm={confirmDelete} onCancel={cancelDelete} title={`Delete ${deepFeed?.name}`} message={`Are you sure you want to delete ${deepFeed?.name}?`} /></>
    );
}

export default DeepFeed;