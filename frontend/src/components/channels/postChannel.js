import axios from "axios";
import React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ContentWidget from "../contentWidget";

//For viewing posts in both group and profile feeds
const PostChannel = ({ canRemove, channelId, channelName, feedId, isGroup }) => {
    const queryClient = useQueryClient();
    const { postId } = useParams();

    const getSinglePost = async () => {
        try{
            const response = await axios.get('/api/channel_posts', {
                params: { isSingle: true, feedId, postId }
            });
            return response.data.post; 
        } catch (error) {
            throw error;
        }
    };

    const getPosts = async () => {
        const isMain = channelName === 'Main';
        const response = await axios.get('/api/channel_posts', {
            params: {
                isSingle: false,
                feedId,
                ...(isMain ? {} : { channel_id: channelId }), //Only include channelId if not viewing Main
            }
        });
        return response.data || [];
    };
    
    //Gets individual post 
    const { data: singlePost, error: singlePostError, isLoading: singlePostLoading } = useQuery({
        queryKey: ['singlePost', postId],
        queryFn: getSinglePost,
        enabled: !!postId //postId only present in url for single posts
    });

    //Gets posts from the channel
    const { data: posts = [], error: postsError, isLoading: postsLoading } = useQuery({
        queryKey: ['posts', channelId, channelName, isGroup, feedId],
        queryFn: getPosts,
        enabled: !postId
    });

    //Updates post list upon removal
    const handlePostRemoved = (postId) => {
        queryClient.setQueryData(
            ['posts', channelId, channelName, isGroup, feedId],
            (posts = []) => posts.filter(post => post.post_id !== postId)
        );
    };
    if (singlePostError) {
        console.log("Error object in useQuery:", singlePostError);
    }
    if (postId && singlePostLoading) return <p>Loading post...</p>;
    if (postId && singlePostError?.response?.status === 404) {console.log("Error fetching post:", singlePostError); 
        return <p>Post not found. Please check the url.</p>;}
    if (postId && singlePostError) return <p>Error getting post, please try again</p>;
    if (!postId && postsError) return <p>Error getting posts, please try again</p>;
    if (!postId && postsLoading) return <p>Loading posts...</p>;
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