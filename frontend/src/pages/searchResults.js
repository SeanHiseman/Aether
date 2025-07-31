import { AuthContext } from '../components/authContext';
import axios from 'axios';
import { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import SmallContentWidget from '../components/content/smallContentWidget';
import FeedWidget from '../components/content/feedWidget';

function chunkFeedsToPairs(feeds) {
	const pairs = [];
	for (let i = 0; i < feeds.length; i += 2) {
		pairs.push(feeds.slice(i, i + 2));
	}
	return pairs;
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
        const searcherId = viewer?.feed_id;
        const response = await axios.get(
            `/api/search/${searcherId}?keyword=${keyword}&limit=24&offset=${pageParam}`
        );
        return response.data;
    };

    //Infinite query to handle pagination
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
        // FIX: Removed feedTypeFilter from queryKey to prevent unnecessary re-fetching
        queryKey: ['searchResults', keyword, viewer?.feed_id],
        queryFn: fetchSearchResults,
        getNextPageParam: (lastPage, allPages) => {
            const fetchedCount = (lastPage.feeds?.length || 0) + (lastPage.posts?.length || 0);
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
		const feedPairs = chunkFeedsToPairs(feeds);
		const postItems = posts.map(p => ({ type: "post", data: p }));
		const feedPairItems = feedPairs.map(f => ({ type: "feedPair", data: f }));
		const allItems = [...postItems, ...feedPairItems];
		return shuffleArray(allItems.slice());
	}, [selectedView, posts, feeds]);

	const [column1, column2] = useMemo(() => {
		if (selectedView !== "combined") return [[], []];
		const col1 = [], col2 = [];
		combinedItems.forEach((item, i) => {
			(i % 2 === 0 ? col1 : col2).push(item);
		});
		return [col1, col2];
	}, [combinedItems, selectedView]);

	const [postsCol1, postsCol2] = useMemo(() => {
		if (selectedView !== "posts") return [[], []];
		const col1 = [], col2 = [];
		posts.forEach((post, i) => {
			(i % 2 === 0 ? col1 : col2).push(post);
		});
		return [col1, col2];
	}, [posts, selectedView]);

	const feedPairs = useMemo(() => chunkFeedsToPairs(feeds), [feeds]);

	const [feedCol1, feedCol2] = useMemo(() => {
		if (selectedView !== "feeds") return [[], []];
		const col1 = [], col2 = [];
		feedPairs.forEach((pair, i) => {
			(i % 2 === 0 ? col1 : col2).push(pair);
		});
		return [col1, col2];
	}, [feedPairs, selectedView]);

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
							<div className="flex flex-row gap-3">
								{[column1, column2].map((column, colIdx) => (
									<div key={colIdx} className="flex flex-col flex-1 gap-3">
										{column.map((item, idx) =>
											item.type === "post" ? (
												<div key={`post-${item.data.post_id}`} className="bg-gray-800 rounded-xl">
													<SmallContentWidget post={item.data} />
												</div>
											) : (
												<div key={`feedpair-${idx}`} className="grid grid-cols-2 gap-3">
													{item.data.map(feed => (
														<FeedWidget
															key={feed.feed_id}
															feed={feed}
															isAuthenticated={isAuthenticated}
															viewerId={viewer?.feed_id}
														/>
													))}
                                                    {item.data.length === 1 && <div key="empty-cell"></div>}
												</div>
											)
										)}
									</div>
								))}
							</div>
						)}
						{selectedView === "posts" && (
							<div className="flex flex-row gap-3">
								{[postsCol1, postsCol2].map((column, colIdx) => (
									<div key={colIdx} className="flex flex-col flex-1">
										{column.map(post => (
											<div key={post.post_id} className="bg-gray-800 rounded-xl break-inside-avoid mb-3">
												<SmallContentWidget post={post} showFullContent={true} showScrollBar={false} />
											</div>
										))}
									</div>
								))}
							</div>
						)}
						{selectedView === "feeds" && (
							<div className="flex flex-row">
								{[feedCol1, feedCol2].map((column, colIdx) => (
									<div key={colIdx} className="flex flex-col flex-1 gap-3">
										{column.map((feedPair, idx) => (
											<div key={idx} className="grid grid-cols-2 gap-3">
												{feedPair.map(feed => (
													<FeedWidget
														key={feed.feed_id}
														feed={feed}
														isAuthenticated={isAuthenticated}
														viewerId={viewer?.feed_id}
													/>
												))}
												{feedPair.length === 1 && <div key="empty-cell"></div>}
											</div>
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
            </aside>
        </div>
    );
};

export default SearchResults;