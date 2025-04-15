import axios from 'axios';
import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import ContentWidget from '../content/contentWidget';

const PostChannel = ({ channelId, channelName, feed, isGroup, onEditClick, onReplyClick }) => {
    const feedId = feed.feed_id;
    const queryClient = useQueryClient();
    const { post_id } = useParams();

    const getSinglePost = async () => {
        const response = await axios.get('/api/channel_posts', { params: { feedId, isSingle: true, postId: post_id } });
        return response.data.post; 
    };

    const getPosts = async ({ pageParam = 0 }) => {
        const response = await axios.get('/api/channel_posts', { params: { channelId, feedId, isSingle: false, limit: 10, offset: pageParam }});
        return response.data;
    };
    
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
    const handlePostRemoved = (removedPostId) => {
        queryClient.setQueryData(
            ['posts', channelId, channelName, feedId, isGroup], 
            (oldData) => {
                if (!oldData) return oldData;
                return {
                    pageParams: oldData.pageParams,
                    pages: oldData.pages.map((page) => 
                        page.filter((post) => post.post_id !== removedPostId)
                    )
                };
            }
        );
    };

    const loaderRef = useRef(null);

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

    if (post_id && singlePostError) {
        if (singlePostError.response?.status === 404) return <p className="text36">Post not found. Please check the URL.</p>;
            return <p className="text36">Error fetching the post. Please try again later.</p>;
    }
    if (!post_id && postsError) return <p className="text36">Error fetching posts. Please try again later.</p>;
    if (post_id && singlePostLoading) return <p className="text36">Loading post...</p>;
    if (!post_id && postsLoading) return <p className="text36">Loading posts...</p>;
    return (
        <div className="channel">
            <div className="channel-content">
                {post_id ? (
                    singlePost ? (
                        <ul className="content-list">
                            <ContentWidget 
                                feed={feed}
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
                ) : postsData && postsData.pages.flat().length > 0 ? (
                    <>
                        <ul className="content-list">
                            {postsData.pages.flat().map(post => (
                                <ContentWidget
                                    key={post.post_id}
                                    feed={feed}
                                    isGroup={isGroup}
                                    onEditClick={onEditClick}
                                    onPostRemoved={handlePostRemoved}
                                    onReplyClick={onReplyClick} 
                                    post={post}
                                />
                            ))}
                        </ul>
                        <div ref={loaderRef}>{isFetchingNextPage && <p className="text36">Loading more posts...</p>}</div>
                    </>
                ) : (
                    <p className="text36">No posts yet</p>
                )}
            </div>
        </div>
    );
}

export default PostChannel;