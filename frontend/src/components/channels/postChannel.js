import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from "../contentWidget";

//For both viewing and uploading posts
function PostChannel({ channelId, channelName, isGroup, locationId }) {
    const [posts, setPosts] = useState([]);

    //Gets posts from channel
    useEffect(() => {
        let url = '';
        //Displays different posts depending on if viewing main channel of a group or profile
        if (channelName === 'Main') {
            url = isGroup ? 'group_main_posts' : 'profile_main_posts';
        } else {
            url = isGroup ? 'group_channel_posts' : 'profile_channel_posts';
        }

        const channelData = new URLSearchParams({
            channel_id: channelId,
            location_id: locationId
        }).toString();

        axios.get(`/api/${url}?${channelData}`)
        .then(response => {
            setPosts(response.data);
        })
        .catch(error => {
             console.error('Error getting posts:', error);
        });
    }, [channelId, channelName, isGroup, locationId]);

    return (
        <div id="channel">
            <div id="channel-content">
                {posts.length > 0 ? (
                    <ul className="content-list">
                        {posts.map(post => (
                            <ContentWidget key={post.post_id} isGroup={isGroup} post={post} />
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