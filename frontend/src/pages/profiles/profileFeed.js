import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from '../../components/contentWidget';

//For viewing, not uploading, posts
function ProfileFeed({ channelId, isGroup, locationId }) {
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        const channelData = new URLSearchParams({
            channel_id: channelId,
            location_id: locationId
        }).toString();

        axios.get(`/api/profile_channel_posts?${channelData}`)
        .then(response => {
            setPosts(response.data);
        })
        .catch(error => {
             console.error('Error getting posts:', error);
        });
    }, [channelId, locationId]);

    return (
        <div id="channel">
            <div id="channel-content">
                {posts.length > 0 ? (
                    <ul className="content-list">
                        {posts.map(post => (
                            <ContentWidget key={post.post_id} isGroup={isGroup} post={post}/>
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