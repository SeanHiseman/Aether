import AlgorithmSelector from '../algorithms/algorithmSelector';
import { AuthContext } from '../components/authContext';
import axios from 'axios';
import { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ChunkFeeds } from '../functions/chunkFeeds';
import ContentWidget from '../components/content/contentWidget';
import FeedWidget from '../components/content/feedWidget';
const FETCH_LIMIT = 48;

const SearchResults = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedTypeFilter, setFeedTypeFilter] = useState('all');
    const [feedPage, setFeedPage] = useState(0);
    const [postPage, setPostPage] = useState(0);
    const [selectedView, setSelectedView] = useState('combined');
    const [searchParams] = useSearchParams();
    const keyword = (searchParams.get('keyword') || '').trim();
    const { isAuthenticated, viewer } = useContext(AuthContext);
    const loaderRef = useRef(null);
    const queryClient = useQueryClient();
    const { rightClasses, updateFeeds } = useOutletContext();
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    const scrollRef = useRef(null);

    //Gets results depending on which type is being viewed
    const fetchSearchResults = useCallback(async ({ pageParam = {} }) => {
        try {
            const recentUpvotes = JSON.parse(localStorage.getItem("recentUpvotes") || "[]");
            const feedOffset = pageParam.feedOffset || feedPage * FETCH_LIMIT;
            const postOffset = pageParam.postOffset || postPage * FETCH_LIMIT;
            const response = await axios.get("/api/search", {
                params: {
                    keyword,
                    limit: FETCH_LIMIT,
                    feedOffset,
                    postOffset,
                    recentUpvotes
                }
            });
            const feeds = response?.data?.feeds || [];
            const posts = response?.data?.posts || [];
            return { feeds, posts };
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Error getting search results");
            return { feeds: [], posts: [] };
        }
    }, [keyword, feedPage, postPage]);

    //Infinite query to handle pagination
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
        queryKey: ['searchResults', keyword, viewer?.feed_id],
        queryFn: fetchSearchResults,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage) return undefined;
            const feedCount = lastPage.feeds?.length || 0;
            const postCount = lastPage.posts?.length || 0;
            if (feedCount === 0 && postCount === 0) return undefined;
            return {
                feedOffset: feedPage * 48 + feedCount,
                postOffset: postPage * 48 + postCount
            };
        },
        enabled: !!keyword
    });

    //Intersection observer for infinite scrolling
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage({
                    pageParam: {
                        feedOffset: feedPage * 48,
                        postOffset: postPage * 48
                    }
                });
                setFeedPage(prev => prev + 1);
                setPostPage(prev => prev + 1);
            }
        });
        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }
        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
        };
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);


    const dropdownToggle = (e) => {
        e.stopPropagation();
        setDropdownOpen((prevOpen) => !prevOpen);
    };
    
    const filteredResults = useMemo(() => {
        if (!data) return { feeds: [], posts: [] };
        let allFeeds = data.pages.flatMap(page => page.feeds || []);
        let allPosts = data.pages.flatMap(page => page.posts || []);
        if (feedTypeFilter !== 'all') {
            allFeeds = allFeeds.filter(feed => (feedTypeFilter === 'group' ? feed.is_group : !feed.is_group));
        }
        return { feeds: allFeeds, posts: allPosts };
    }, [data, feedTypeFilter]);
    
    const { feeds, posts } = filteredResults;

    const combinedItems = useMemo(() => {
        if (selectedView !== "combined") return [];
        const feedTriplets = ChunkFeeds(feeds, 3).map(f => ({ type: "feedTriplet", data: f }));
        const postItems = posts.map(p => ({ type: "post", data: p }));
        const interspersed = [];
        const POSTS_PER_BLOCK = 5; 
        let postIndex = 0;
        let feedIndex = 0;
        while (postIndex < postItems.length || feedIndex < feedTriplets.length) {
            for (let i = 0; i < POSTS_PER_BLOCK && postIndex < postItems.length; i++) {
                interspersed.push(postItems[postIndex]);
                postIndex++;
            }
            if (feedIndex < feedTriplets.length) {
                interspersed.push(feedTriplets[feedIndex]);
                feedIndex++;
            }
        }
        return interspersed;
    }, [selectedView, posts, feeds]);

    useEffect(() => {
        if (error) {
            setErrorMessage('Failed to load results. Please try again.');
        }
    }, [error]);

    const refreshPosts = () => {
        setRefreshTrigger(!refreshTrigger);
    };

    //Refresh posts upon algorithm change
    useEffect(() => {
        if (refreshTrigger === false) return; 
        queryClient.invalidateQueries(['searchResults', keyword, viewer?.feed_id]);
    }, [refreshTrigger, queryClient, keyword, viewer?.feed_id]);

    document.title = 'Search';
    return (
        <div className="standard-container">
            <div ref={scrollRef} className="channel-feed">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
						<span className="text-xl faded-text">Loading results...</span>
					</div>
                ) : isError ? (
                    <div className="flex justify-center items-center h-64">
						<span className="text-xl faded-text">Failed to load results. Please try again.</span>
					</div>
                ) : (posts.length === 0 && feeds.length === 0) ? (
                    <div className="flex justify-center items-center h-64">
						<span className="text-xl faded-text">No results found</span>
					</div>
                ) : (
                    <>
						{selectedView === "combined" && (
							<div className="flex flex-col gap-3 w-99">
								{combinedItems.map((item, idx) =>
									item.type === "post" ? (
										<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl w-full">
											<ContentWidget post={item.data} />
										</div>
									) : (
										<div key={`feedtriplet-${idx}`} className="grid grid-cols-3 gap-3 w-full">
											{item.data.map(feed => (
												<FeedWidget key={feed.feed_id} feed={feed} isAuthenticated={isAuthenticated} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
											))}
										</div>
									)
								)}
							</div>
						)}
						{selectedView === "posts" && (
							<div className="flex flex-col gap-3 w-99">
								{posts.map(post => (
									<div key={post?.post_id} className="bg-gray-800 rounded-xl w-full">
										<ContentWidget post={post} />
									</div>
								))}
							</div>
						)}
						{selectedView === "feeds" && (
							<div className="flex flex-col gap-3 w-99">
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full">
                                    {feeds.map(feed => (
                                        <FeedWidget key={feed?.feed_id} feed={feed} isAuthenticated={isAuthenticated} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
                                    ))}
                                </div>
							</div>
						)}
                        <div ref={loaderRef} className="h-20 flex justify-center items-center">
                            {isFetchingNextPage && <p className="text-lg faded-text">Loading more...</p>}
                        </div>
					</>
                )}
            </div>
            <aside className={rightClasses}>
                <p className="large-text bold">Results for "{keyword}"</p>
                <div className="error-message">{errorMessage}</div>
                <nav className="channel-list">
                    <ul>
                        <li className="channel-link" onClick={() => setSelectedView('combined')}>All results</li>
                        <li className="channel-link" onClick={() => setSelectedView('posts')}>Posts</li>
                        <li className="channel-link" onClick={() => { setSelectedView('feeds'); setDropdownOpen(false)}}>Feeds
                            <div className="channel-dropdown" onClick={dropdownToggle}>{dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}</div> 
                        </li>
                        {dropdownOpen && selectedView === 'feeds' && (
                            <ul style={{ marginLeft: '10px' }}>
                                <li className="channel-link" onClick={(e) => { e.stopPropagation(); setFeedTypeFilter('all'); setDropdownOpen(false); }}>All feeds</li>
                                <li className="channel-link" onClick={(e) => { e.stopPropagation(); setFeedTypeFilter('group'); setDropdownOpen(false); }}>Groups</li>
                                <li className="channel-link" onClick={(e) => { e.stopPropagation(); setFeedTypeFilter('user'); setDropdownOpen(false); }}>Users</li>
                            </ul>
                        )}
                    </ul>
                </nav>
				{isAuthenticated && <AlgorithmSelector locationId={"search"} refreshPosts={refreshPosts} />} {/* Project code */}
            </aside>
        </div>
    );
};

export default SearchResults;