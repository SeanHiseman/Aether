import api from '../../api';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content/contentWidget';
const FETCH_LIMIT = 100;

const PostChannel = ({ channelId, channelName, feed, isDraft, isEditMode, isGroup, refreshTrigger }) => {
	const { channel_name, post_id } = useParams();
	const channelReady = !!channelId;
	const feedId = feed?.feed_id;
	const isMain = channel_name === 'Main';
	const queryClient = useQueryClient();
	const scrollRef = useRef(null);
	const { user, viewer } = useContext(AuthContext);
	const navigate = useNavigate();

	useEffect(() => {
		if (refreshTrigger !== undefined) {
			queryClient.invalidateQueries(['posts', channelId, channelName, feedId, isGroup]);
			if (post_id) {
				queryClient.invalidateQueries(['singlePost', post_id]);
			}
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
			return response.data?.post;
		} catch (error) {
			throw error;
		}
	};

	const getPosts = async ({ pageParam = 0 }) => {
		try {
			const recentUpvotes = JSON.parse(localStorage.getItem("recentUpvotes") || "[]");
			const response = await api.post('/channel_posts', { channelId, feedId, isMain, isGroup: feed?.is_group, isSingle: false, limit: FETCH_LIMIT, offset: pageParam, recentUpvotes });
			return response.data?.posts || [];
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
		const shouldFetch = element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
		if (shouldFetch) fetchNext();
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
		} else if (!postsData?.pages.flat().length && !postsLoading) {
			channelMessage = 'No posts yet';
		}
	}

	const renderList = (items) =>
		items?.map((post) => (
			<ContentWidget key={post?.post_id} feed={feed} isDraft={isDraft} onPostRemoved={handlePostRemoved} post={post} />
		));

	return (
		<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
			{channelMessage ? (
				<p className="large-text faded-text">{channelMessage}</p>
			) : (post_id && !isEditMode) ? (
				<div className="flex flex-col w-99">
					<div className="bg-gray-800 rounded-xl">
						<ContentWidget feed={feed} isDraft={isDraft} onPostRemoved={handlePostRemoved} post={singlePost} />
					</div>
				</div>
			) : isDraft ? (
				<div className="flex flex-col w-99">
					<p className="large-text">Drafts</p>
					{draftsData?.pages.flat().map((post) => (
						<div key={post?.draft_id || Math.random()} className="bg-gray-800 rounded-xl">
							<ContentWidget feed={feed} isDraft={isDraft} onPostRemoved={handlePostRemoved} post={post} />
						</div>
					))}
				</div>
			) : (
				<div className="flex flex-col w-99">
					{postsData?.pages.flat().map((post) => (
						<div key={post?.post_id || Math.random()} className="bg-gray-800 rounded-xl">
							<ContentWidget feed={feed} isDraft={isDraft} onPostRemoved={handlePostRemoved} post={post} />
						</div>
					))}
				</div>
			)}
			{((isDraft && isFetchingDrafts) || (!isDraft && isFetchingNextPage)) && (
				<p className="large-text faded-text">Loading more {isDraft ? 'drafts' : 'posts'}...</p>
			)}
		</div>
	);
};

export default PostChannel;