import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from "../contentWidget";

//For viewing posts in both group and profile feeds
const PostChannel = ({ canRemove, channelId, channelName, isGroup, locationId }) => {
    const [posts, setPosts] = useState([]);
    const [showYoutube, setShowYoutube] = useState(false);
    const [videos, setVideos] = useState([]);
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
                console.log("response.data", response.data);
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

    const youtubeButton = async () => {
        setShowYoutube(true);
        try {
            const response = await axios.get('/api/youtube_content');
            const youtubeVideos = response.data.items.map(video => ({
                post_id: video.id.videoId,
                title: video.snippet.title,
                content: `
                    <p>${video.snippet.description}</p>
                    <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}" />
                    <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank" rel="noopener noreferrer">Watch Video</a>
                `,
                poster_id: 'YouTube', 
                GroupPoster: { username: 'YouTube' }, 
                is_group: false,
                views: 0, 
                upvotes: 0,
                downvotes: 0,
                replies: 0,
                points: 0,
                timestamp: video.snippet.publishedAt,
            }));
            setVideos(youtubeVideos);
        } catch (error) {
            console.error('Error fetching YouTube videos:', error.message);
        }
    };
    
    return (
        <div className="channel">
            <button className="button" onClick={youtubeButton}>Youtube</button>
            <div className="channel-content">
                {!showYoutube ? (
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
                ) : (
                    <ul className="content-list">
                        {videos.map(video => (
                            <ContentWidget
                                key={video.post_id}
                                canRemove={false} 
                                isGroup={false} 
                                post={video}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
export default PostChannel;