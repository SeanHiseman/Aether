import axios from "axios";
import React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ContentWidget from "../contentWidget";

//For viewing posts in both group and profile feeds
const PostChannel = ({ canRemove, channelId, channelName, isGroup, locationId }) => {
    const queryClient = useQueryClient();
    const { postId } = useParams();

    const getSinglePost = async () => {
        const response = await axios.get('/api/channel_posts', {
            params: { isGroup, postId, isSingle: true }
        });
        return response.data.post;
    };

    const getPosts = async () => {
        const isMain = channelName === 'Main';
        const response = await axios.get('/api/channel_posts', {
            params: {
                isGroup,
                location_id: locationId,
                ...(isMain ? {} : { channel_id: channelId }), //Only include channelId if not viewing Main
                isSingle: false
            }
        });
        return response.data;
    };
    
    //Gets individual post 
    const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
        queryKey: ['singlePost', postId],
        queryFn: getSinglePost,
        enabled: !!postId
    });

    //Gets posts from the channel
    const { data: posts = [], error: postsError, isLoading: postsLoading } = useQuery({
        queryKey: ['posts', channelId, channelName, isGroup, locationId],
        queryFn: getPosts,
        enabled: !postId
    });

    //Updates post list upon removal
    const handlePostRemoved = (postId) => {
        queryClient.setQueryData(
            ['posts', channelId, channelName, isGroup, locationId],
            posts => posts.filter(post => post.post_id !== postId)
        );
    };

    if (postId && singlePostLoading) return <p>Loading post...</p>;
    if (postId && singlePostError) return <p>Error getting post: {singlePostError.message}</p>;
    if (postId && !singlePostLoading && !singlePost) {
        return <p>Post not found. Please check the url.</p>;
    }
    if (!postId && postsLoading) return <p>Loading posts...</p>;
    if (!postId && postsError) return <p>Error getting posts: {postsError.message}</p>;
    return (
        <div className="channel">
            <div className="channel-content">
                {postId ? (
                    <ul className="content-list">
                        <ContentWidget 
                            post={singlePost} 
                            canRemove={canRemove}
                            isGroup={isGroup}
                            onPostRemoved={handlePostRemoved}
                        />
                    </ul> 
                ) : (
                    posts.length > 0 ? (
                        <ul className="content-list">
                            {posts.map(post => (
                                <ContentWidget
                                    key={post.post_id}
                                    canRemove={canRemove}
                                    isGroup={isGroup}
                                    onPostRemoved={handlePostRemoved}
                                    post={post}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p>No posts yet</p>
                    )
                )}
            </div>
        </div>
    );
}
export default PostChannel;