import api from '../../api';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content/contentWidget';
import ExternalPostWidget from '../../socialConnect/externalPostWidget';
import RepostIndicator from '../content/repostIndicator';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
const FETCH_LIMIT = 100;

const PostChannel = ({ channelId, channelName, feed, includeGroup, includeReposts, includeUser, isDraft, isEditMode, isGroup, refreshTrigger, setFeedErrorMessage }) => {
	const { channel_name, post_id } = useParams();
	const channelReady = !!channelId;
	const feedId = feed?.feed_id;
	const isMain = channel_name === 'Main';
	const queryClient = useQueryClient();
	const scrollRef = useRef(null);
	const lastFetchTimeRef = useRef(0);
	const filterChangeTimeRef = useRef(0);
	const { user, viewer } = useContext(AuthContext);
	const navigate = useNavigate();

	useEffect(() => {
		queryClient.invalidateQueries(['posts', channelId, channelName, feedId, isGroup]);
	}, [includeGroup, includeUser, queryClient, channelId, channelName, feedId, isGroup]);

	useEffect(() => {
		if (refreshTrigger === 0) return;
		queryClient.invalidateQueries(['posts', channelId, channelName, feedId, isGroup]);
		if (post_id) {
			queryClient.invalidateQueries(['singlePost', post_id]);
		}
	}, [refreshTrigger, queryClient, channelId, channelName, feedId, isGroup, post_id]);

	useEffect(() => {
		if (isDraft && !isGroup && viewer?.feed_id !== feedId) {
			navigate(`/u/${feed?.feed_name}/Main`, { replace: true });
		}
	}, [feedId, isDraft, isGroup, navigate, user?.feed_id, viewer?.handle]);

	const getSinglePost = async () => {
		try {
			const response = await api.post('/channel_posts', { feedId, isSingle: true, postId: post_id });
			return {
				parent: response.data?.parent || null,
				post: response.data?.post || null
			};
		} catch (error) {
			throw error;
		}
	};

	const getPosts = async ({ pageParam = 0 }) => {
		try {
			const recentUpvotes = JSON.parse(localStorage.getItem("recentUpvotes") || "[]");
			const response = await api.post('/channel_posts', { channelId, feedId, isMain, isGroup: feed?.is_group, isSingle: false, limit: FETCH_LIMIT, offset: pageParam, recentUpvotes });
			const posts = Array.isArray(response.data?.posts) ? response.data.posts : [];
			const status = response.data?.status;
			const message = response.data?.message;
			if (pageParam === 0 && message) {
				setFeedErrorMessage(message);
			}
			return posts;
		} catch (error) {
			if (error.response?.status === 404) {
				return [];
			}
			throw error;
		}
	};

	const getDrafts = async ({ pageParam = 0 }) => {
		try {
			const response = await api.get('/get_post_drafts', { params: { channel_id: channelId, poster_id: viewer?.feed_id, limit: FETCH_LIMIT, offset: pageParam } });
			return response.data?.drafts;
		} catch (error) {
			throw error;
		}
	};

	const { data: draftsData, error: draftsError, fetchNextPage: fetchNextDrafts, hasNextPage: hasMoreDrafts, isFetchingNextPage: isFetchingDrafts, isLoading: draftsLoading } = useInfiniteQuery({
		enabled: !post_id && isDraft && channelReady,
		queryKey: ['drafts', channelId, viewer?.feed_id],
		queryFn: getDrafts,
		getNextPageParam: (lastPage, allPages) => {
			const nextParam = lastPage.length === FETCH_LIMIT ? allPages.length * FETCH_LIMIT : undefined;
			return nextParam;
		}
	});

	const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
		enabled: !!post_id && channelReady,
		queryFn: getSinglePost,
		queryKey: ['singlePost', post_id]
	});

	const { data: postsData, error: postsError, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: postsLoading } = useInfiniteQuery({
		enabled: !post_id && !isDraft && channelReady,
		getNextPageParam: (lastPage, allPages) => {
			const nextParam = lastPage.length === FETCH_LIMIT ? allPages.length * FETCH_LIMIT : undefined;
			return nextParam;
		},
		queryFn: getPosts,
		queryKey: ['posts', channelId, channelName, feedId, isGroup]
	});

	const handlePostRemoved = (removedId) => {
		if (isDraft) {
			queryClient.setQueryData(['drafts', channelId, viewer?.feed_id], (old) => {
				if (!old) return old;
				return { ...old, pages: old.pages.map((page) => page.filter((d) => d.draft_id !== removedId)) };
			});
		} else {
			queryClient.setQueryData(['posts', channelId, channelName, feedId, isGroup], (old) => {
				if (!old) return old;
				return { ...old, pages: old.pages.map((page) => page.filter((p) => p.post_id !== removedId)) };
			});
		}
	};

	const threshold = window.innerHeight * 1.5; //1.5 vertical height away from bottom

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		const isFetching = isDraft ? isFetchingDrafts : isFetchingNextPage;
		const hasMore = isDraft ? hasMoreDrafts : hasNextPage;
		const fetchNext = isDraft ? fetchNextDrafts : fetchNextPage;
		if (isFetching || !hasMore) return;

		const now = Date.now();
		// Prevent fetching too frequently (debounce)
		if (now - lastFetchTimeRef.current < 500) return;
		// Don't fetch right after filter change (prevents spam when page height changes)
		if (now - filterChangeTimeRef.current < 1000) return;

		const shouldFetch = element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
		if (shouldFetch) {
			lastFetchTimeRef.current = now;
			fetchNext();
		}
	}, [isDraft, isFetchingDrafts, hasMoreDrafts, fetchNextDrafts, isFetchingNextPage, hasNextPage, fetchNextPage]);

	useEffect(() => {
		const scrollHandler = () => {
			const element = scrollRef.current;
			if (!element) return;
			const isFetching = isDraft ? isFetchingDrafts : isFetchingNextPage;
			const hasMore = isDraft ? hasMoreDrafts : hasNextPage;
			const fetchNext = isDraft ? fetchNextDrafts : fetchNextPage;
			if (isFetching || !hasMore) return;
			const distanceFromBottom = element.scrollHeight - window.scrollY - window.innerHeight;
			if (distanceFromBottom <= threshold) fetchNext();
		};
		window.addEventListener('scroll', scrollHandler);
		return () => window.removeEventListener('scroll', scrollHandler);
	}, [isDraft, isFetchingDrafts, hasMoreDrafts, fetchNextDrafts, isFetchingNextPage, hasNextPage, fetchNextPage]);

	// Track filter changes to prevent scroll spam
	useEffect(() => {
		filterChangeTimeRef.current = Date.now();
	}, [includeUser, includeGroup, includeReposts]);

	const allPosts = postsData?.pages.flat() || [];
	const filteredPosts = allPosts.filter((post) => {
		const isRepost = post.is_repost;
		// Reposts are a separate category - check them first
		if (isRepost) {
			return includeReposts;
		}
		// For non-reposts, apply user/group filters
		const isUserPost = post.feed_id === feedId;
		if (isUserPost && !includeUser) return false;
		if (!isUserPost && !includeGroup) return false;
		return true;
	});
	let channelMessage = '';

	if (post_id && !isEditMode) {
		if (singlePostError) {
            channelMessage = singlePostError.response?.status === 404 ? 'Post not found. Please check the URL.' : 'Error fetching the post. Please try again later.';
        } else if (!singlePost && !singlePostLoading) {
            channelMessage = 'No post available';
        }
    } else if (isDraft) {
		if (draftsError) {
			channelMessage = 'Error fetching drafts. Please try again.';
		} else if (!draftsData?.pages.flat().length) {
			channelMessage = 'No drafts yet';
		}
	} else {
		if (postsError) {
			channelMessage = 'Error fetching posts. Please try again.';
		} else if (!postsLoading && allPosts.length && !filteredPosts.length) {
			channelMessage = 'All posts hidden';
		} else if (!postsLoading && !allPosts.length) {
			channelMessage = 'No posts yet';
		}
	}

	return (
		<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
			{channelMessage ? (
				<p className="large-text faded-text">{channelMessage}</p>
			) : (post_id && !isEditMode) ? (
				<div className="flex flex-col w-99">
					<div className="med-mar-bottom">
						{singlePost?.parent && (
							<ContentWidget
								feed={feed}
								isDraft={isDraft}
								post={singlePost?.parent}
								showAsParent
							/>
						)}
						{singlePost?.post && (
							<ContentWidget
								feed={feed}
								isDraft={isDraft}
								onPostRemoved={handlePostRemoved}
								parent={singlePost?.parent || null}
								post={singlePost.post}
							/>
						)}
					</div>
				</div>
			) : isDraft ? (
				<div className="flex flex-col w-99">
					<p className="large-text">Drafts</p>
					{draftsData?.pages.flat().map((post) => (
						<div key={post?.draft_id || Math.random()} className="med-mar-bottom">
							<ContentWidget feed={feed} isDraft={isDraft} onPostRemoved={handlePostRemoved} post={post} />
						</div>
					))}
				</div>
			) : (
				<div className="flex flex-col w-99">
					{filteredPosts.map((post) => {
						return (
							<div key={post?.post_id || Math.random()} className="med-mar-bottom">
								{post?.is_repost && (
									<RepostIndicator
										reposter={{ feed_id: post?.reposted_by, feed_name: post?.reposted_by_name || 'Unknown' }}
										repostedAt={post.reposted_at}
									/>
								)}
								{/* Display parent post above reply if this post is a reply */}
								{post?.parentPost && !post?.isExternal && !post?.is_external && (
									<ContentWidget
										feed={feed}
										isDraft={isDraft}
										post={post.parentPost}
										showAsParent
									/>
								)}
								{post?.isExternal || post?.is_external ? (
									<ExternalPostWidget post={post} />
								) : (
									<ContentWidget feed={feed} isDraft={isDraft} onPostRemoved={handlePostRemoved} parent={post?.parentPost || null} post={post} />
								)}
							</div>
						);
					})}
				</div>
			)}
			{((isDraft && isFetchingDrafts) || (!isDraft && isFetchingNextPage)) && (
				<p className="large-text faded-text">Loading more {isDraft ? 'drafts' : 'posts'}...</p>
			)}
		</div>
	);
};

export default PostChannel;