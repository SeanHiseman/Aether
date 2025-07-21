import { useCallback, useContext, useEffect, useRef, useState, memo } from "react";
import { AuthContext } from "../../components/authContext";
import axios from "axios";
import SmallContentWidget from "../../components/content/smallContentWidget";
import FeedWidget from "../../components/content/feedWidget";
import { useOutletContext } from "react-router-dom";
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

const ExplorePage = () => {
    const [errorMessage, setErrorMessage] = useState("");
    const [feedPage, setFeedPage] = useState(0);
    const [feeds, setFeeds] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [postPage, setPostPage] = useState(0);
    const [posts, setPosts] = useState([]);
    const { isAuthenticated, viewer } = useContext(AuthContext);
    const { rightClasses } = useOutletContext();
    const listRef = useRef(null);
    const [listHeight, setListHeight] = useState(window.innerHeight - 100);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setListHeight(window.innerHeight - 100);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchPosts = useCallback(
        async (page = 0) => {
            console.log('fetchPosts called with page:', page, 'filter:', filter);
            try {
                const res = await axios.get("/api/explore_posts", {
                    params: { filter, limit: 4, offset: page * 4 },
                });
                console.log('Posts API response:', res.data);
                setPosts(prev => {
                    const newPosts = page === 0 ? res.data.posts : [...prev, ...res.data.posts];
                    console.log('Setting posts:', newPosts);
                    return newPosts;
                });
            } catch (error) {
                console.error("Error fetching posts:", error);
                setErrorMessage("Failed to fetch posts");
            }
        },
        [filter]
    );

    const fetchFeeds = useCallback(
        async (page = 0) => {
            console.log('fetchFeeds called with page:', page);
            try {
                const res = await axios.get("/api/explore_feeds", {
                    params: { limit: 6, offset: page * 6 },
                });
                console.log('Feeds API response:', res.data);
                setFeeds(prev => {
                    const newFeeds = page === 0 ? res.data.feeds : [...prev, ...res.data.feeds];
                    console.log('Setting feeds:', newFeeds);
                    return newFeeds;
                });
            } catch (error) {
                console.error("Error fetching feeds:", error);
                setErrorMessage("Failed to fetch feeds");
            }
        },
        [filter]
    );

    useEffect(() => {
        setLoading(true);
        setFeedPage(0);
        setPostPage(0);
        setPosts([]);
        setFeeds([]);
        
        Promise.all([fetchPosts(0), fetchFeeds(0)])
            .then(() => setLoading(false))
            .catch(() => setLoading(false));
    }, [filter, fetchFeeds, fetchPosts]);

    const loadMore = useCallback(async () => {
        if (loading || loadingMore) return;
        setLoadingMore(true);
        
        try {
            await Promise.all([fetchPosts(postPage + 1), fetchFeeds(feedPage + 1)]);
            setPostPage(p => p + 1);
            setFeedPage(f => f + 1);
        } catch (error) {
            console.error("Error loading more:", error);
        } finally {
            setLoadingMore(false);
        }
    }, [loading, loadingMore, fetchPosts, fetchFeeds, postPage, feedPage]);

    // Calculate total items with better handling
    const getItemCount = useCallback(() => {
        const count = (() => {
            if (loading) {
                console.log('getItemCount: still loading, returning 0');
                return 0;
            }
            
            console.log('getItemCount - posts:', posts.length, 'feeds:', feeds.length);
            
            if (posts.length === 0 && feeds.length === 0) {
                console.log('getItemCount: no data, returning 1');
                return 1;
            }
            
            if (filter === "all") {
                const postRows = Math.ceil(posts.length / 4) || 0;
                const feedRows = Math.ceil(feeds.length / 6) || 0;
                const total = Math.max(1, Math.max(postRows, feedRows) * 2) + 1;
                console.log('getItemCount (all):', { postRows, feedRows, total });
                return total;
            } else if (filter === "posts") {
                const total = Math.max(1, Math.ceil(posts.length / 2)) + 1;
                console.log('getItemCount (posts):', total);
                return total;
            } else {
                const total = Math.max(1, Math.ceil(feeds.length / 6)) + 1;
                console.log('getItemCount (feeds):', total);
                return total;
            }
        })();
        
        return count;
    }, [filter, posts.length, feeds.length, loading]);

    // Row renderer for virtual scrolling
    const Row = memo(({ index, style }) => {
        const itemCount = getItemCount();
        console.log('Row render - index:', index, 'itemCount:', itemCount, 'style:', style);
        
        // Handle empty state
        if (posts.length === 0 && feeds.length === 0 && index === 0) {
            console.log('Row: Rendering empty state');
            return (
                <div style={style} className="flex justify-center items-center h-full">
                    <span className="text-gray-400 text-lg">No content available</span>
                </div>
            );
        }
        
        // Handle loading row
        if (index >= itemCount - 1) {
            return (
                <div style={style} className="flex justify-center items-center py-4">
                    {loadingMore ? (
                        <span className="text-gray-400">Loading more...</span>
                    ) : (
                        <div className="h-10" /> // Empty space to trigger loading
                    )}
                </div>
            );
        }

        if (filter === "all") {
            const sectionIndex = Math.floor(index / 2);
            const isPostSection = index % 2 === 0;
            
            if (isPostSection) {
                const startIdx = sectionIndex * 4;
                const postsToShow = posts.slice(startIdx, startIdx + 4);
                
                // Return empty div with proper height if no posts
                if (postsToShow.length === 0) {
                    return <div style={style} />;
                }
                
                return (
                    <div style={style} className="w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 px-4">
                            {postsToShow.map(post => (
                                <div key={post.post_id} className="bg-gray-800 rounded-xl shadow hover:shadow-lg transition h-full">
                                    <SmallContentWidget post={post} />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            } else {
                const startIdx = sectionIndex * 6;
                const feedsToShow = feeds.slice(startIdx, startIdx + 6);
                
                // Return empty div with proper height if no feeds
                if (feedsToShow.length === 0) {
                    return <div style={style} />;
                }
                
                return (
                    <div style={style} className="w-full">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 px-4">
                            {feedsToShow.map(feed => (
                                <FeedWidget key={feed.feed_id} feed={feed} />
                            ))}
                        </div>
                    </div>
                );
            }
        } else if (filter === "posts") {
            const startIdx = index * 2;
            const postsToShow = posts.slice(startIdx, startIdx + 2);
            
            // Return empty div if no posts
            if (postsToShow.length === 0) {
                return <div style={style} />;
            }
            
            return (
                <div style={style} className="w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 px-4">
                        {postsToShow.map(post => (
                            <div key={post.post_id} className="bg-gray-800 rounded-xl">
                                <SmallContentWidget post={post} />
                            </div>
                        ))}
                    </div>
                </div>
            );
        } else { // channels/feeds filter
            const startIdx = index * 6;
            const feedsToShow = feeds.slice(startIdx, startIdx + 6);
            
            // Return empty div if no feeds
            if (feedsToShow.length === 0) {
                return <div style={style} />;
            }
            
            return (
                <div style={style} className="w-full">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4">
                        {feedsToShow.map(feed => (
                            <FeedWidget key={feed.feed_id} feed={feed} />
                        ))}
                    </div>
                </div>
            );
        }
    });

    Row.displayName = 'VirtualRow';

    // Check if more items need to be loaded
    const isItemLoaded = useCallback(index => {
        // Loading row is never loaded
        if (index >= getItemCount() - 1) return false;
        
        // Empty state is always "loaded"
        if (posts.length === 0 && feeds.length === 0) return true;
        
        if (filter === "all") {
            const sectionIndex = Math.floor(index / 2);
            const isPostSection = index % 2 === 0;
            
            if (isPostSection) {
                return sectionIndex * 4 < posts.length;
            } else {
                return sectionIndex * 6 < feeds.length;
            }
        } else if (filter === "posts") {
            return index * 2 < posts.length;
        } else {
            return index * 6 < feeds.length;
        }
    }, [filter, posts.length, feeds.length, getItemCount]);

    // Load more items for infinite loader
    const loadMoreItems = useCallback(async (startIndex, stopIndex) => {
        if (!loadingMore && !loading) {
            await loadMore();
        }
    }, [loadingMore, loading, loadMore]);

    // Get row height based on content type
    const getItemSize = useCallback((index) => {
        // Loading or empty state row
        if (index >= getItemCount() - 1 || (posts.length === 0 && feeds.length === 0)) {
            return 100;
        }
        
        if (filter === "all") {
            const isPostSection = index % 2 === 0;
            return isPostSection ? 400 : 250; // Adjusted heights
        } else if (filter === "posts") {
            return 400;
        } else {
            return 250;
        }
    }, [filter, getItemCount, posts.length, feeds.length]);

    console.log('ExplorePage render - loading:', loading, 'posts:', posts.length, 'feeds:', feeds.length, 'filter:', filter);
    const itemCount = getItemCount();
    console.log('Final itemCount for render:', itemCount);

    // Also add this after the useEffect that loads data
    useEffect(() => {
        console.log('Data state changed - posts:', posts, 'feeds:', feeds);
    }, [posts, feeds]);
        
    return (
        <div className="standard-container">
            <div className="channel-feed h-full" style={{ height: 'calc(100vh - 100px)' }}>
                {errorMessage && (
                    <div className="bg-red-500 text-white p-3 rounded mb-4">
                        {errorMessage}
                    </div>
                )}
                
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <span className="text-xl text-gray-400">Loading...</span>
                    </div>
                ) : itemCount === 0 ? (
                    <div className="flex justify-center items-center h-64">
                        <span className="text-xl text-gray-400">No content available</span>
                    </div>
                ) : (
                    <InfiniteLoader
                        isItemLoaded={isItemLoaded}
                        itemCount={itemCount}
                        loadMoreItems={loadMoreItems}
                        minimumBatchSize={10}
                        threshold={5}
                    >
                        {({ onItemsRendered, ref }) => (
                            <List
                                ref={(list) => {
                                    ref(list);
                                    listRef.current = list;
                                }}
                                height={Math.max(listHeight, 400)}
                                itemCount={itemCount}
                                itemSize={getItemSize}
                                onItemsRendered={onItemsRendered}
                                width="100%"
                                overscanCount={2}
                                className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                            >
                                {Row}
                            </List>
                        )}
                    </InfiniteLoader>
                )}
            </div>
            <aside className={`${rightClasses} w-80 bg-gray-900 p-4`}>
                {errorMessage && (
                    <p className="error-message text-red-500 mb-4">{errorMessage}</p>
                )}
                <p className="large-text text-white mb-4">Filters</p>
                <nav className="channel-list">
                    <ul className="space-y-2">
                        <li 
                            className={`channel-link cursor-pointer p-2 rounded transition-colors ${
                                filter === "all" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            }`} 
                            onClick={() => setFilter("all")}
                        >
                            All
                        </li>
                        <li 
                            className={`channel-link cursor-pointer p-2 rounded transition-colors ${
                                filter === "posts" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            }`} 
                            onClick={() => setFilter("posts")}
                        >
                            Posts
                        </li>
                        <li 
                            className={`channel-link cursor-pointer p-2 rounded transition-colors ${
                                filter === "channels" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            }`} 
                            onClick={() => setFilter("channels")}
                        >
                            Feeds
                        </li>
                    </ul>
                </nav>
            </aside>
        </div>
    );
};

export default ExplorePage;
//Code doesn't render anything