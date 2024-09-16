import axios from "axios";
import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ContentWidget from "../contentWidget";

//For viewing posts in both group and profile feeds
const PostChannel = ({ canRemove, channelId, channelName, isGroup, locationId }) => {
    const queryClient = useQueryClient();

    const getPosts = async () => {
        const isMain = channelName === 'Main';
        const response = await axios.get('/api/channel_posts', {
            params: {
                isGroup,
                location_id: locationId,
                ...(isMain ? {} : { channel_id: channelId }) //Only include channelId if not viewing Main
            }
        });
        return response.data;
    };

    //Gets posts from the channel
    const { data: posts = [], error, isLoading } = useQuery({
        queryKey: ['posts', channelId, channelName, isGroup, locationId],
        queryFn: getPosts
    });

    //Updates post list upon removal
    const handlePostRemoved = (postId) => {
        queryClient.setQueryData(
            ['posts', channelId, channelName, isGroup, locationId],
            posts => posts.filter(post => post.post_id !== postId)
        );
    };

    if (isLoading) {
        return <p>Loading posts...</p>;
    }

    if (error) {
        return <p>Error getting posts: {error.message}</p>;
    }
    
    return (
        <div className="channel">
            <div className="channel-content">
                {posts.length > 0 ? (
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
                )}
            </div>
        </div>
    );
}
export default PostChannel;