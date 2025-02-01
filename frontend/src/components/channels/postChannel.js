import axios from 'axios';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ContentWidget from '../content/contentWidget';

const PostChannel = ({ canRemove, channelId, channelName, feed, isGroup, onEditClick, onReplyClick }) => {
    const queryClient = useQueryClient();
    const { post_id } = useParams();
    const feedId = feed.feed_id;

    const getSinglePost = async () => {
        const response = await axios.get('/api/channel_posts', {
            params: { isSingle: true, feedId: feed.feed_id, postId: post_id }
        });
        return response.data.post; 
    };

    const getPosts = async () => {
        const response = await axios.get('/api/channel_posts', {
            params: { isSingle: false, feedId, channelId }
        });
        return response.data || [];
    };
    
    //Gets individual post 
    const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
        queryKey: ['singlePost', post_id],
        queryFn: getSinglePost,
        enabled: !!post_id //post_id only present in url for single posts
    });

    //Gets posts from the channel
    const { data: posts = [], error: postsError, isLoading: postsLoading } = useQuery({
        queryKey: ['posts', channelId, channelName, isGroup, feedId],
        queryFn: getPosts,
        enabled: !post_id
    });

    //Updates post list upon removal
    const handlePostRemoved = (removedPostId) => {
        queryClient.setQueryData(
            ['posts', channelId, channelName, isGroup, feedId],
            (oldPosts = []) => oldPosts.filter(post => post.post_id !== removedPostId)
        );
    };

    if (post_id && singlePostError) {
        if (singlePostError.response?.status === 404) {
            return <p className="text36">Post not found. Please check the URL.</p>;
        }
        return <p className="text36">Error fetching the post. Please try again later.</p>;
    }
    if (!post_id && postsError) {
        return <p className="text36">Error fetching posts. Please try again later.</p>;
    }
    if (post_id && singlePostLoading) {
        return <p className="text36">Loading post...</p>;
    }
    if (!post_id && postsLoading) {
        return <p className="text36">Loading posts...</p>;
    }
    return (
        <div className="channel">
            <div className="channel-content">
                {post_id ? (
                    singlePost ? (
                        <ul className="content-list">
                            <ContentWidget 
                                canRemove={canRemove}
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
                ) : (
                    posts.length > 0 ? (
                        <ul className="content-list">
                            {posts.map(post => (
                                <ContentWidget
                                    key={post.post_id}
                                    canRemove={canRemove}
                                    feed={feed}
                                    isGroup={isGroup}
                                    onEditClick={onEditClick}
                                    onPostRemoved={handlePostRemoved}
                                    onReplyClick={onReplyClick} 
                                    post={post}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="text36">No posts yet</p>
                    )
                )}
            </div>
        </div>
    );
}

export default PostChannel;