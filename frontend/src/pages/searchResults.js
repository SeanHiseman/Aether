import { AuthContext } from '../components/authContext';
import axios from 'axios';
import { useContext, useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import SmallContentWidget from '../components/content/smallContentWidget';
import FeedWidget from '../components/content/feedWidget';

const SearchResults = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedTypeFilter, setFeedTypeFilter] = useState('all');
    const [selectedView, setSelectedView] = useState('combined');
    const [searchParams] = useSearchParams();
    const keyword = (searchParams.get('keyword') || '').trim();
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const loaderRef = useRef(null);
    const { rightClasses } = useOutletContext(); 
    const CLEANUP_THRESHOLD = 100; //Remove old posts and feeds from rendered list

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
        let feedIndex = 0;
        let postIndex = 0;
        const sections = [];
        while (postIndex < posts.length || feedIndex < feeds.length) {
            if (postIndex < posts.length) {
                sections.push(
                    <div key={`posts-${postIndex}`} className="grid grid-cols-2 gap-3 mb-3">
                        {posts.slice(postIndex, postIndex + 2).map(post => (
                            <div key={post.post_id} className="bg-gray-800 rounded-xl">
                                <SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
                            </div>
                        ))}
                    </div>
                );
                postIndex += 2;
            }
            if (feedIndex < feeds.length) {
                sections.push(
                    <div key={`feeds-${feedIndex}`} className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                        {feeds.slice(feedIndex, feedIndex + 6).map(feed => (
                            <FeedWidget
                                key={feed.feed_id}
                                feed={feed}
                                isAuthenticated={isAuthenticated}
                                viewerId={viewer?.feed_id}
                            />
                        ))}
                    </div>
                );
                feedIndex += 6;
            }
        }
        return sections;
    };

    document.title = 'Search';
    return (
        <div className="standard-container">
            <div className="channel-feed">
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
                    </ul>
                </nav>
            </aside>
        </div>
    );
};

export default SearchResults;