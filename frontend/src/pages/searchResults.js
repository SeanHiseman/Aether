import { AuthContext } from '../components/authContext';
import axios from 'axios';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import ContentWidget from '../components/content/contentWidget';
import FeedWidget from '../components/search/feedWidget';

const SearchResults = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedTypeFilter, setFeedTypeFilter] = useState('all');
    const [selectedView, setSelectedView] = useState('combined');
    const [searchParams] = useSearchParams();
    const keyword = (searchParams.get('keyword') || '').trim();
    const [timePreference, setTimePreference] = useState(0.001);
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const loaderRef = useRef(null);
    const { rightClasses } = useOutletContext(); 

    //Gets results depending on which type is being viewed
    const fetchSearchResults = async ({ pageParam = 0 }) => {
        const searcherId = viewer?.feed_id;
        const response = await axios.get(
            `/api/search/${searcherId}?keyword=${keyword}&limit=10&offset=${pageParam}`
        );
        return response.data;
    };

    //Infinite query to handle pagination
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
        queryKey: ['searchResults', keyword, viewer?.feed_id],
        queryFn: fetchSearchResults,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.feeds.length + lastPage.posts.length >= 10 ? allPages.length * 10 : undefined;
        },
        enabled: !!keyword
    });

    //Intersection observer for infinite scrolling
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        });
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => {
            if (loaderRef.current) observer.unobserve(loaderRef.current);
        };
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    //Load user's time preference
    //useEffect(() => {
        //const getTimePreference = async () => {
            //try {
                //const response = axios.get('/api/get_time_preference');
                //setTimePreference(response.data.preference);
            //} catch (error) {
                //console.error('Error getting preference:', error);
            //}
        //}
        //getTimePreference();
    //}, []);

    //Save time value to backend
    const handleTimeChange = (event) => {
        try {
            const newValue = parseFloat(event.target.value);
            setTimePreference(newValue);
            axios.post('/api/set_time_preference', { preference: newValue })
            //setTimePreference(response.data);
        } catch (error) {
            setErrorMessage('Error saving time preference');
        }
    };

    const getFilteredResults = () => {
        if (!data) return { feeds: [], posts: [] };
        let allFeeds = [];
        let allPosts = [];
        data.pages.forEach(page => {
            if (page.feeds) allFeeds = [...allFeeds, ...page.feeds];
            if (page.posts) allPosts = [...allPosts, ...page.posts];
        });
        if (feedTypeFilter !== 'all') {
            allFeeds = allFeeds.filter(feed => (feedTypeFilter === 'group' ? feed.is_group : !feed.is_group));
        }
        switch (selectedView) {
            case 'posts':
                return { feeds: [], posts: allPosts };
            case 'feeds':
                return { feeds: allFeeds, posts: [] };
            case 'combined':
            default:
                return { feeds: allFeeds, posts: allPosts };
        }
    };

    const filteredResults = getFilteredResults();
    
    const renderResults = () => {
        if (isLoading) {
            return <p className="text36" style={{textAlign: 'center'}}>Loading results...</p>;
        }
        if (isError) {
            return <p className="text36" style={{textAlign: 'center'}}>Failed to load results. Please try again.</p>;
        }
        const { feeds, posts } = filteredResults;
        if (feeds.length === 0 && posts.length === 0) {
            return <p className="text36" style={{textAlign: 'center'}}>No results found</p>;
        }
        return (
            <>
                {feeds.length > 0 && feeds.map((feed) => (
                    <FeedWidget key={feed.feed_id} feed={feed} isAuthenticated={isAuthenticated} viewerId={viewer?.feed_id} />
                ))}
                {posts.length > 0 && posts.map((post) => (
                    <ContentWidget key={post.post_id} feed={post.feed} post={post} isGroup={post.is_group} />
                ))}
            </>
        );
    };

    document.title = 'Search';
    return (
        <div className="standard-container">
            <div className="content-feed">
                <div className="channel-content">
                    <ul className="content-list">
                        {renderResults()}
                        <div ref={loaderRef}>
                            {isFetchingNextPage && <p className="text36">Loading more results...</p>}
                        </div>
                    </ul>
                </div>
            </div>
            <aside className={rightClasses}>
                <p className="text36">Results</p>
                <div className="error-message">{errorMessage}</div>
                <nav className="channel-list">
                    <ul>
                        <li className="channel-link" onClick={() => setSelectedView('combined')}>All results</li>
                        <li className="channel-link" onClick={() => setSelectedView('posts')}>Posts</li>
                        <li className="channel-link" onClick={() => setSelectedView('feeds')}>Feeds
                            <div className="channel-dropdown" onClick={dropdownToggle}>{dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}</div> 
                        </li>
                        {dropdownOpen && (
                            <ul style={{ marginLeft: '10px' }}>
                                <li className="channel-link" onClick={() => setFeedTypeFilter('all')}>All feeds</li>
                                <li className="channel-link" onClick={() => setFeedTypeFilter('group')}>Groups</li>
                                <li className="channel-link" onClick={() => setFeedTypeFilter('user')}>Users</li>
                            </ul>
                        )}
                        {/*<label>Posts are recent:</label>
                        <input type="range" min="0" max="0.01" step="0.00001" value={timePreference} onChange={handleTimeChange} />*/}
                    </ul>
                </nav>
            </aside>
        </div>
    );
};

export default SearchResults;
