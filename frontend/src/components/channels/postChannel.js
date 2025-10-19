import api from '../../api';
import { useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content/contentWidget';
const FETCH_LIMIT = 50;

const PostChannel = ({ channelId, channelName, feed, isDraft, isEditMode, isGroup, refreshTrigger }) => {
	const channelReady = !!channelId;
	const feedId = feed?.feed_id;
	const loaderRef = useRef(null);
	const queryClient = useQueryClient();
	const { channel_name, post_id } = useParams();
	const { user, viewer } = useContext(AuthContext);
	const isMain = channel_name === 'Main';
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
			return response.data.post;
		} catch (error) {
			throw error;
		}
	};

	const getPosts = async ({ pageParam = 0 }) => {
		try {
			const recentUpvotes = JSON.parse(localStorage.getItem("recentUpvotes") || "[]");
			const response = await api.post('/channel_posts', { channelId, feedId, isMain, isGroup: feed?.is_group, isSingle: false, limit: FETCH_LIMIT, offset: pageParam, recentUpvotes });
			return response.data.posts || [];
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
		getNextPageParam: (lastPage, allPages) => lastPage.length === FETCH_LIMIT ? allPages.length * FETCH_LIMIT : undefined
	});

	const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
		enabled: !!post_id && channelReady,
		queryFn: getSinglePost,
		queryKey: ['singlePost', post_id]
	});

	const { data: postsData, error: postsError, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: postsLoading } = useInfiniteQuery({
		enabled: !post_id,
		getNextPageParam: (lastPage, allPages) => lastPage.length === FETCH_LIMIT ? allPages.length * FETCH_LIMIT : undefined,
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

	useEffect(() => {
		const obs = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) return;
			if (isDraft) {
				hasMoreDrafts && !isFetchingDrafts && fetchNextDrafts();
			} else {
				hasNextPage && !isFetchingNextPage && fetchNextPage();
			}
		});
		loaderRef.current && obs.observe(loaderRef.current);
		return () => loaderRef.current && obs.unobserve(loaderRef.current);
	}, [isDraft, hasMoreDrafts, isFetchingDrafts, fetchNextDrafts, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
			<ContentWidget
				key={post?.post_id}
				feed={feed}
				isDraft={isDraft}
				onPostRemoved={handlePostRemoved}
				post={post}
			/>
		));

    return (
        <div className="channel">
            <div className="channel-content">
                {channelMessage ? (
                    <p className="large-text faded-text">{channelMessage}</p>
                ) : (post_id && !isEditMode) ? (
                    <ul className="content-list">
                        <ContentWidget
                            feed={feed}
                            isDraft={isDraft}
                            onPostRemoved={handlePostRemoved}
                            post={singlePost}
                        />
                    </ul>
                ) : isDraft ? (
                    <ul className="content-list">
                        <p className="large-text">Drafts</p>
                        {renderList(draftsData?.pages.flat())}
                    </ul>
                ) : (
                    <ul className="content-list">{renderList(postsData?.pages.flat())}</ul>
                )}
				<div ref={loaderRef}>
					{((isDraft && isFetchingDrafts) || (!isDraft && isFetchingNextPage)) && (
						<p className="large-text faded-text">Loading more {isDraft ? 'drafts' : 'posts'}...</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default PostChannel;