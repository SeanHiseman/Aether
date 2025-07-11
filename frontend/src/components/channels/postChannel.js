import axios from 'axios';
import { useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content/contentWidget';

const PostChannel = ({ channelId, channelName, feed, isDraft, isGroup, onEditClick, onReplyClick }) => {
	const channelReady = !!channelId;
	const feedId = feed.feed_id;
	const loaderRef = useRef(null);
	const queryClient = useQueryClient();
	const { channel_name, post_id } = useParams();
	const { isAuthenticated, user, viewer } = useContext(AuthContext);
	const isMain = channel_name === 'Main';
	const navigate = useNavigate();
	const PAGE_SIZE = 10;

	useEffect(() => {
		if (isDraft && !isGroup && viewer?.feed_id !== feedId) {
			navigate(`/u/${feed?.feed_name}/Main`, { replace: true });
		}
	}, [feedId, isDraft, isGroup, navigate, user?.feed_id, viewer?.handle]);

	const getSinglePost = async () => {
		try {
			const response = await axios.get('/api/channel_posts', { params: { feedId, isSingle: true, postId: post_id } });
			return response.data.post;
		} catch (error) {
			throw error;
		}
	};

	const getPosts = async ({ pageParam = 0 }) => {
		try {
			const response = await axios.get('/api/channel_posts', { params: { channelId, feedId, isMain, isSingle: false, limit: 10, offset: pageParam } });
			return response.data;
		} catch (error) {
			console.log("error getting posts:", error);
			if (error.response?.status === 404) {
				return [];
			}
			throw error;
		}
	};

	const getDrafts = async ({ pageParam = 0 }) => {
		try {
			const response = await axios.get('/api/get_post_drafts', { params: { channel_id: channelId, poster_id: viewer?.feed_id, limit: PAGE_SIZE, offset: pageParam } });
			return response.data.drafts;
		} catch (error) {
			throw error;
		}
	};

	const { data: draftsData, error: draftsError, fetchNextPage: fetchNextDrafts, hasNextPage: hasMoreDrafts, isFetchingNextPage: isFetchingDrafts, isLoading: draftsLoading } = useInfiniteQuery({
		enabled: !post_id && isDraft && channelReady,
		queryKey: ['drafts', channelId, viewer?.feed_id],
		queryFn: getDrafts,
		getNextPageParam: (lastPage, allPages) => lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined
	});

	const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
		enabled: !!post_id && channelReady,
		queryFn: getSinglePost,
		queryKey: ['singlePost', post_id]
	});

	const { data: postsData, error: postsError, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: postsLoading } = useInfiniteQuery({
		enabled: !post_id,
		getNextPageParam: (lastPage, allPages) => lastPage.length === 10 ? allPages.length * 10 : undefined,
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

	if (!channelReady) {
		channelMessage = 'Loading channel...';
	} else if (post_id) {
		if (singlePostLoading) {
			channelMessage = 'Loading post...';
		} else if (singlePostError) {
			channelMessage = singlePostError.response?.status === 404 ? 'Post not found. Please check the URL.' : 'Error fetching the post. Please try again later.';
		} else if (!singlePost) {
			channelMessage = 'No post available';
		}
	} else if (isDraft) {
		if (draftsLoading) {
			channelMessage = 'Loading drafts...';
		} else if (draftsError) {
			channelMessage = 'Error fetching drafts. Please try again later.';
		} else if (!draftsData?.pages.flat().length) {
			channelMessage = 'No drafts yet';
		}
	} else {
		if (postsLoading) {
			channelMessage = 'Loading posts...';
		} else if (postsError) {
			channelMessage = 'Error fetching posts. Please try again later.';
		} else if (!postsData?.pages.flat().length) {
			channelMessage = 'No posts yet';
		}
	}

	const renderList = (items) =>
		items.map((post) => (
			<ContentWidget
				key={post.post_id}
				feed={feed}
				isDraft={isDraft}
				isGroup={isGroup}
				onEditClick={onEditClick}
				onPostRemoved={handlePostRemoved}
				onReplyClick={onReplyClick}
				post={post}
			/>
		));

	return (
		<div className="channel">
			<div className="channel-content">
				{channelMessage ? (
					<p className="text36">{channelMessage}</p>
				) : post_id ? (
					<ul className="content-list">
						<ContentWidget
							feed={feed}
							isDraft={isDraft}
							isGroup={isGroup}
							onEditClick={onEditClick}
							onPostRemoved={handlePostRemoved}
							onReplyClick={onReplyClick}
							post={singlePost}
						/>
					</ul>
				) : isDraft ? (
					<ul className="content-list">
						<p className="text36">Drafts</p>
						{renderList(draftsData.pages.flat())}
					</ul>
				) : (
					<ul className="content-list">{renderList(postsData.pages.flat())}</ul>
				)}
				<div ref={loaderRef}>
					{((isDraft && isFetchingDrafts) || (!isDraft && isFetchingNextPage)) && (
						<p className="text36">Loading more {isDraft ? 'drafts' : 'posts'}...</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default PostChannel;