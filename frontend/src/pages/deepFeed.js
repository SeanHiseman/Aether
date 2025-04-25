import axios from 'axios';
import { DragDropContext } from 'react-beautiful-dnd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaEdit, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import ContentWidget from '../components/content/contentWidget';
import DeepFeedItem from '../components/channels/deepFeedItem';
import { useInfiniteQuery } from '@tanstack/react-query';

const DeepFeed = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const { deep_feed_id } = useParams();
    const [deepFeed, setDeepFeed] = useState({
        deep_feed_id: null,
        name: '',
        owner_id: null,
        parent_id: null
    });
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [timePreference, setTimePreference] = useState(0.001);
    const navigate = useNavigate();
    
    const getPosts = async ({ pageParam = 0 }) => {
        try {
            const response = await axios.get('/api/deep_feed_posts', {
                params: {
                    deepFeedId: deep_feed_id,
                    limit: 10,
                    offset: pageParam
                }
            });
            if (pageParam === 0 && response.data.deepFeed) {
                setDeepFeed(response.data.deepFeed);
                document.title = response.data.deepFeed.name;
            } else if (deep_feed_id === 'following') {
                setDeepFeed({
                    deep_feed_id: 'following',
                    name: 'Following',
                    owner_id: 'system',
                    parent_id: null,
                });
                document.title = 'Following';
            }
            return response.data.posts;
        } catch (error) {
            setErrorMessage('Error fetching posts');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return [];
        }
    };

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, status } = useInfiniteQuery({
        queryKey: ['deepFeedPosts', deep_feed_id],
        queryFn: getPosts,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 10 ? allPages.length * 10 : undefined;
        }
    });

    const loaderRef = useRef(null);

    const changeDeepFeedName = async (event) => {
        event.preventDefault();
        try {
            if (newName.length === 0) {
                setErrorMessage("Needs a name");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            if (newName.trim() === 'following') {
                setErrorMessage("Cannot be named 'Following'");
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            } 
            const response = await axios.post('/api/change_deep_feed_name', {
                deepFeedId: deep_feed_id,
                newName
            });
            if (response.status === 200) {
                setErrorMessage('');
                setIsEditingName(false);
                setNewName('');
                setDeepFeed((prev) => ({ ...prev, name: newName }));
                document.title = newName;
            }
        } catch {
            setErrorMessage("Error changing name");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${deepFeed.name}?`)) {
            try {
                if (deepFeed.name === 'Following') {
                    setErrorMessage("Following cannot be deleted.");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
                const response = await axios.delete('/api/delete_deep_feed', { data: { deepFeedId: deep_feed_id } });
                if (response.data.success) {
                    setDeepFeed((prev) => { //Sets deepFeed to Following, with other properties null
                        const updated = { name: 'Following' };
                        for (const key in prev) {
                            if (key !== 'name') {
                                updated[key] = null;
                            }
                        }
                        return updated;
                    });                    
                    setErrorMessage('');
                    navigate('/d/following');
                }
            } catch (error) {
                setErrorMessage('Error deleting deep feed');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        }
    };

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

    const allPosts = data ? data.pages.flatMap(page => page) : [];

    //Load user's time preference (outdated)
    useEffect(() => {
        const fetchTimePreference = async () => {
            try {
                const response = await axios.get('/api/get_time_preference');
                setTimePreference(response.data.preference);
            } catch (error) {
                setErrorMessage('Error getting preference');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        };
        fetchTimePreference();
    }, []);

    //Save time value to backend (outdated)
    const handleTimeChange = (event) => {
        try {
            const newValue = parseFloat(event.target.value);
            setTimePreference(newValue);
            axios.post('/api/set_time_preference', { preference: newValue })
        } catch (error) {
            setErrorMessage('Error changing preference');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="standard-container">
            <div className="content-feed">
                <div className="channel-content">
                    {allPosts.length > 0 ? (
                        <>
                            <ul className="content-list">
                                {allPosts.map((post) => (
                                    <ContentWidget 
                                        key={post.post_id} 
                                        feed={post.poster} 
                                        isGroup={post.is_group} 
                                        post={post}
                                    />
                                ))}
                            </ul>
                            <div ref={loaderRef}>
                                {isFetchingNextPage && <p className="text36">Loading more posts...</p>}
                            </div>
                        </>
                    ) : (
                        <p className="text36">No posts yet</p>
                    )}
                </div>
            </div>
            <aside className="right-aside">
                <div className="channel-name-section">
                    {isEditingName ? (
                        <div className="change-name">
                            <textarea
                                className="change-name-area"
                                onChange={(e) => {
                                    e.preventDefault();
                                    const input = e.target.value;
                                    if (input.length <= 30) {
                                        setNewName(input);
                                        if (input.trim() === 'following') {
                                            setErrorMessage("Cannot be named 'Following'");
                                        } else {
                                            setErrorMessage(""); 
                                        }
                                    } else {
                                        setErrorMessage("Name too long");
                                    }
                                }}
                                placeholder="New name"
                                value={newName} />
                            <div className="cancel-save">
                                <button className="small-icon" onClick={() => {setIsEditingName(false); setNewName(""); setErrorMessage("");}} title="Cancel">
                                    <FaRegWindowClose />
                                </button>
                                <button className="small-icon" onClick={changeDeepFeedName} title="Save">
                                    <FaSave />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name">
                            <p className="text36">{deepFeed.name}</p>
                            <div className="button-group">
                                {deepFeed?.name !== "Following" && ( 
                                    <>
                                        <button
                                            className="small-icon"
                                            onClick={() => {
                                                setIsEditingName(true);
                                                setNewName(deepFeed.name);
                                            }}
                                            title="Edit name"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button className="small-icon" onClick={handleDelete} title="Delete Deep Feed">
                                            <FaTrash />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="error-message">{errorMessage}</div>
                </div>
                {/*<label>Posts are recent:</label>
                <input type="range" min="0" max="0.001" step="0.00001" value={timePreference} onChange={handleTimeChange} />*/}
                {/*<DeepFeedItem 
                    index={0} 
                    deepFeed={deepFeed} 
                    showHeader={false} 
                    onFeedAdded={registerFeedCallback}
                />*/}
            </aside>
        </div>
    );
}

export default DeepFeed;