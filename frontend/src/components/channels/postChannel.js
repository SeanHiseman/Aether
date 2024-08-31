import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from "../contentWidget";

//For both viewing and uploading posts
function PostChannel({ canRemove, channelId, channelName, isGroup, locationId }) {
    const [posts, setPosts] = useState([]);

    //Gets posts from channel
    useEffect(() => {
        const getPosts = async () => {
            try {
                const isMain = channelName === 'Main';
                const url = isGroup ? 'group_channel_posts' : 'profile_channel_posts';
      
                const response = await axios.get(`/api/${url}`, {
                    params: {
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
      

    return (
        <div id="channel">
            <div className="channel-content">
                {posts.length > 0 ? (
                    <ul className="content-list">
                        {posts.map(post => (
                            <ContentWidget key={post.post_id} canRemove={canRemove} isGroup={isGroup} post={post} />
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