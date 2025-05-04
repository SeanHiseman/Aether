import axios from 'axios';
import React, { useContext, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content/contentWidget';

const PostChannel = ({ channelId, channelName, feed, isDraft, isGroup, onEditClick, onReplyClick }) => {
    const feedId = feed.feed_id;
    const loaderRef = useRef(null);
    const queryClient = useQueryClient();
    const { post_id } = useParams();
    const { viewer } = useContext(AuthContext);
    const PAGE_SIZE = 10;

    const getSinglePost = async () => {
        const response = await axios.get('/api/channel_posts', { params: { feedId, isSingle: true, postId: post_id } });
        return response.data.post; 
    };

    const getPosts = async ({ pageParam = 0 }) => {
        const response = await axios.get('/api/channel_posts', { params: { channelId, feedId, isSingle: false, limit: 10, offset: pageParam }});
        return response.data;
    };
    
    const getDrafts = async ({ pageParam = 0 }) => {
        console.log("getting drafts");
        const response = await axios.get('/api/get_post_drafts', { params: { channel_id: channelId, poster_id: viewer?.feed_id, limit: PAGE_SIZE, offset: pageParam }});
        console.log("response:", response);
        return response.data.drafts; 
    };

    const { data: draftsData, error: draftsError, fetchNextPage: fetchNextDrafts, hasNextPage: hasMoreDrafts, isFetchingNextPage: isFetchingDrafts, isLoading: draftsLoading } = useInfiniteQuery({
        enabled: !post_id && isDraft,
        queryKey: ['drafts', channelId, viewer?.feed_id],
        queryFn: getDrafts,
        getNextPageParam: (lastPage, allPages) =>
          lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined
    });

    //Gets individual post 
    const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
        enabled: !!post_id, //post_id only present in url for single posts
        queryFn: getSinglePost,
        queryKey: ['singlePost', post_id]
    });

    //Gets posts from the channel 
    const { data: postsData, error: postsError, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: postsLoading } = useInfiniteQuery({
        enabled: !post_id,
        getNextPageParam: (lastPage, allPages) => (lastPage.length === 10 ? allPages.length * 10 : undefined),
        queryFn: getPosts,
        queryKey: ['posts', channelId, channelName, feedId, isGroup]
    });

    //Updates post list upon removal
    const handlePostRemoved = (removedId) => {
        if (isDraft) {
            queryClient.setQueryData(
                ['drafts', channelId, viewer?.feed_id],
                (old) => {
                    if (!old) return old
                    return {
                        ...old,
                        pages: old.pages.map((page) =>
                            page.filter((d) => d.draft_id !== removedId)
                        )
                    }
                }
            )
        } else {
            queryClient.setQueryData(
                ['posts', channelId, channelName, feedId, isGroup],
                (old) => {
                if (!old) return old
                    return {
                        ...old,
                        pages: old.pages.map((page) =>
                            page.filter((p) => p.post_id !== removedId)
                        )
                    }
                }
            )
        }
    }

    useEffect(() => {
        const obs = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return
            if (isDraft) {
                hasMoreDrafts && !isFetchingDrafts && fetchNextDrafts()
            } else {
                hasNextPage && !isFetchingNextPage && fetchNextPage()
            }
        })
        loaderRef.current && obs.observe(loaderRef.current)
        return () => loaderRef.current && obs.unobserve(loaderRef.current)
    }, [isDraft, hasMoreDrafts, isFetchingDrafts, fetchNextDrafts, hasNextPage, isFetchingNextPage, fetchNextPage])

    if (post_id && singlePostError) {
        if (singlePostError.response?.status === 404) {
            return <p className="text36">Post not found. Please check the URL.</p>;
        }
        return <p className="text36">Error fetching the post. Please try again later.</p>;
    }
    if (!post_id && !isDraft && postsError) {
        return <p className="text36">Error fetching posts. Please try again later.</p>;
    }
    if (!post_id && isDraft && draftsError) {
        return <p className="text36">Error fetching drafts. Please try again later.</p>;
    }
    if (post_id && singlePostLoading) {
        return <p className="text36">Loading post...</p>;
    }
    if (!post_id && !isDraft && postsLoading) {
        return <p className="text36">Loading posts...</p>;
    }
    if (!post_id && isDraft && draftsLoading) {
        return <p className="text36">Loading drafts...</p>;
    }   
    const renderList = items =>
        items.map(post => (
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
                {post_id ? (
                    singlePost ? (
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
                    ) : (
                        <p className="text36">No post available.</p>
                    )
                ) : (
                    <>
                        {isDraft ? (
                            draftsData?.pages.flat().length > 0 ? (
                                <ul className="content-list">
                                    <p className="text36">Drafts</p>
                                    {renderList(draftsData.pages.flat())}
                                </ul>
                            ) : (
                                <p className="text36">No drafts yet</p>
                            )
                        ) : postsData?.pages.flat().length > 0 ? (
                            <ul className="content-list">
                                {renderList(postsData.pages.flat())}
                            </ul>
                        ) : (
                            <p className="text36">No posts yet</p>
                        )}
                        <div ref={loaderRef}>
                            {((isDraft && isFetchingDrafts) || (!isDraft && isFetchingNextPage)) && (
                                <p className="text36">
                                    Loading more {isDraft ? 'drafts' : 'posts'}...
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PostChannel;