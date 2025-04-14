import axios from 'axios';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../components/authContext';
import ContentWidget from '../components/content/contentWidget';
import { useInfiniteQuery } from '@tanstack/react-query';

const DeepFeed = () => {
    const { viewer } = useContext(AuthContext);
    const [errorMessage, setErrorMessage] = useState('');
    const { deep_feed_id } = useParams();
    const [deepFeedName, setDeepFeedName] = useState('');
    const [timePreference, setTimePreference] = useState(0.001);
    
    const [fetchNextPageState, setFetchNextPageState] = useState({ 
        isFetchingNextPage: false, 
        hasNextPage: false,
        fetchNextPage: () => {}
    });

    const observerRef = useRef();
    const lastPostElementRef = useCallback(node => {
        if (isFetchingNextPage) return;
        if (observerRef.current) observerRef.current.disconnect();
        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });
        if (node) observerRef.current.observe(node);
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, status } = useInfiniteQuery({
        queryKey: ['deepFeedPosts', deep_feed_id],
        queryFn: async ({ pageParam = 0 }) => {
            const response = await axios.get('/api/deep_feed_posts', {
                params: {
                    deepFeedId: deep_feed_id,
                    limit: 10,
                    offset: pageParam
                }
            });
            console.log("response", response.data.posts);
            if (pageParam === 0 && response.data.deepFeedName) {
                setDeepFeedName(response.data.deepFeedName);
                document.title = response.data.deepFeedName;
            }
            return response.data.posts;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 10 ? allPages.length * 10 : undefined;
        },
    });
    
    useEffect(() => {
        setFetchNextPageState({
            isFetchingNextPage,
            hasNextPage,
            fetchNextPage
        });
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    //Load user's time preference (not used yet)
    useEffect(() => {
        const fetchTimePreference = async () => {
            try {
                const response = await axios.get('/api/get_time_preference');
                setTimePreference(response.data.preference);
            } catch (error) {
                setErrorMessage('Error getting preference');
            }
        };
        fetchTimePreference();
    }, []);

    //Save time value to backend (not used yet)
    const handleTimeChange = (event) => {
        try {
            const newValue = parseFloat(event.target.value);
            setTimePreference(newValue);
            axios.post('/api/set_time_preference', { preference: newValue })
        } catch (error) {
            setErrorMessage('Error changing preference');
        }
    };

    const allPosts = data ? data.pages.flatMap(page => page) : [];

    return (
        <div className="standard-container">
            <div className="content-feed">
                <div className="channel-content">
                    {allPosts.length > 0 ? (
                        <ul className="content-list">
                            {allPosts.map((post, index) => {
                                if (allPosts.length === index + 1) {
                                    return (
                                        <div key={post.post_id} ref={lastPostElementRef}>
                                            <ContentWidget feed={post.poster} isGroup={post.is_group} post={post}/>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <ContentWidget key={post.post_id} feed={post.poster} isGroup={post.is_group} post={post}/>
                                    );
                                }
                            })}
                        </ul>
                    ) : (
                        <p className="text36">No posts yet</p>
                    )}
                    {isFetchingNextPage && (
                        <div className="text36">Loading more posts...</div>
                    )}
                </div>
            </div>
            <aside className="right-aside">
                <h1>{deepFeedName}</h1>
                {/*<label>Posts are recent:</label>
                <input type="range" min="0" max="0.001" step="0.00001" value={timePreference} onChange={handleTimeChange} />
                <div className="error-message">{errorMessage}</div>*/}
            </aside>
        </div>
    )
}

export default DeepFeed;