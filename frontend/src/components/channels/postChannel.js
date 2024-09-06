import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from "../contentWidget";

//For viewing posts in both group and profile feeds
const PostChannel = ({ canRemove, channelId, channelName, isGroup, locationId }) => {
    const [posts, setPosts] = useState([]);
    
    //Gets posts from channel
    useEffect(() => {
        const getPosts = async () => {
            try {
                const isMain = channelName === 'Main';
                const response = await axios.get('/api/channel_posts', {
                    params: {
                        isGroup,
                        location_id: locationId,
                        ...(isMain ? {} : { channel_id: channelId }) //Only include channelId if not viewing Main
                    }
                });
                setPosts(response.data);
            } catch (error) {
                console.error('Error getting posts:', error);
            }
        };
        getPosts();
    }, [channelId, channelName, isGroup, locationId]);
    
    //Updates post list upon removal
    const handlePostRemoved = (postId) => {
        setPosts((prevPosts) => prevPosts.filter(post => post.post_id !== postId));
    };

    return (
        <div id="channel">
            <div className="channel-content">
                {posts.length > 0 ? (
                    <ul className="content-list">
                        {posts.map(post => (
                            <ContentWidget key={post.post_id} canRemove={canRemove} isGroup={isGroup} onPostRemoved={handlePostRemoved} post={post} />
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