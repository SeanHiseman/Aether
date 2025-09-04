import AlgorithmSelector from '../algorithms/algorithmSelector';
import { AuthContext } from '../components/authContext';
import axios from 'axios';
import { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import SmallContentWidget from '../components/content/smallContentWidget';
import FeedWidget from '../components/content/feedWidget';

function chunkFeedsToQuads(feeds) {
	const quads = [];
	for (let i = 0; i < feeds.length; i += 4) {
		quads.push(feeds.slice(i, i + 4));
	}
	return quads;
}

function shuffleArray(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

const SearchResults = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedTypeFilter, setFeedTypeFilter] = useState('all');
    const [selectedView, setSelectedView] = useState('combined');
    const [searchParams] = useSearchParams();
    const keyword = (searchParams.get('keyword') || '').trim();
    const { isAuthenticated, viewer } = useContext(AuthContext);
    const loaderRef = useRef(null);
    const { rightClasses } = useOutletContext();
    const scrollRef = useRef(null);

    //Gets results depending on which type is being viewed
    const fetchSearchResults = async ({ pageParam = 0 }) => {
        try {
            console.log("fetching search results");
            const response = await axios.get(
                `/api/search/?keyword=${keyword}&limit=24&offset=${pageParam}`
            );
            console.log("search response:", response);
            return response.data || { feeds: [], posts: [] };
        } catch (error) {
            console.log("error:", error);
            const message = error.response?.data?.message || "Error getting search results";
            setErrorMessage(message);
            // Return safe empty structure so react-query doesn't crash
            return { feeds: [], posts: [] };
        }
    };

    //Infinite query to handle pagination
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
        queryKey: ['searchResults', keyword, viewer?.feed_id],
        queryFn: fetchSearchResults,
        getNextPageParam: (lastPage, allPages) => {
            const fetchedCount = ((lastPage?.feeds?.length || 0) + (lastPage?.posts?.length || 0));
            return fetchedCount > 0 ? (allPages.length * 24) : undefined;
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
		const feedQuads = chunkFeedsToQuads(feeds);
		const postItems = posts.map(p => ({ type: "post", data: p }));
		const feedQuadItems = feedQuads.map(f => ({ type: "feedQuad", data: f }));
		const allItems = [...postItems, ...feedQuadItems];
		return shuffleArray(allItems.slice());
	}, [selectedView, posts, feeds]);

	const feedQuads = useMemo(() => chunkFeedsToQuads(feeds), [feeds]);

    useEffect(() => {
        if (error) {
            setErrorMessage('Failed to load results. Please try again.');
        }
    }, [error]);

    document.title = 'Search';
    return (
        <div className="standard-container">
            <div
				ref={scrollRef}
				className="channel-feed"
			>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
						<span className="text-xl text-gray-400">Loading results...</span>
					</div>
                ) : isError ? (
                    <div className="flex justify-center items-center h-64">
						<span className="text-xl text-gray-400">Failed to load results. Please try again.</span>
					</div>
                ) : (posts.length === 0 && feeds.length === 0) ? (
                    <div className="flex justify-center items-center h-64">
						<span className="text-xl text-gray-400">No results found</span>
					</div>
                ) : (
                    <>
						{selectedView === "combined" && (
							<div className="flex flex-col gap-3 w-99">
								{combinedItems.map((item, idx) =>
									item.type === "post" ? (
										<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl w-full">
											<SmallContentWidget post={item.data} showFullContent={true} showScrollBar={false} />
										</div>
									) : (
										<div key={`feedquad-${idx}`} className="grid grid-cols-4 gap-3 w-full">
											{item.data.map(feed => (
												<FeedWidget
													key={feed.feed_id}
													feed={feed}
													isAuthenticated={isAuthenticated}
													viewerId={viewer?.feed_id}
												/>
											))}
										</div>
									)
								)}
							</div>
						)}
						{selectedView === "posts" && (
							<div className="flex flex-col gap-3 w-99">
								{posts.map(post => (
									<div key={post.post_id} className="bg-gray-800 rounded-xl w-full">
										<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
									</div>
								))}
							</div>
						)}
						{selectedView === "feeds" && (
							<div className="flex flex-col gap-3 w-99">
								{feedQuads.map((feedQuad, idx) => (
									<div key={idx} className="grid grid-cols-4 gap-3 w-full">
										{feedQuad.map(feed => (
											<FeedWidget
												key={feed.feed_id}
												feed={feed}
												isAuthenticated={isAuthenticated}
												viewerId={viewer?.feed_id}
											/>
										))}
									</div>
								))}
							</div>
						)}
                        <div ref={loaderRef} className="h-20 flex justify-center items-center">
                            {isFetchingNextPage && <p className="text-lg text-gray-400">Loading more...</p>}
                        </div>
					</>
                )}
            </div>
            <aside className={rightClasses}>
                <p className="large-text">Results for "{keyword}"</p>
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
				{isAuthenticated && <AlgorithmSelector locationId={"search"} />} {/* Project code */}
            </aside>
        </div>
    );
};

export default SearchResults;