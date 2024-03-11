import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from "../content_widget";

function ProfileFeed({ channelId, channelName, locationId }) {
    const [posts, setPosts] = useState([]);
    //Fetch posts in a profile channel
    useEffect(() => {
        axios.get(`/api/profile_channel_posts/${locationId}/${channelId}`)
        .then(response => {
            setPosts(response.data);
        })
        .catch(error => {
             console.error('Error getting posts:', error);
        });
    });

    return (
        <div id="channel">
            <div id="channel-header">
                <p class="large-text">{channelName}</p>
            </div>
            <div id="channel-content">
                {posts.length > 0 ? (
                    <ul>
                        {posts.map(post => (
                            <ContentWidget key={post.post_id} post={post}/>
                        ))}
                    </ul>
                ) : (
                    <p>No posts yet</p>
                )}
            </div>
        </div>
    );
}
export default ProfileFeed;