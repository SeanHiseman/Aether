import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from '../../components/contentWidget';

//For viewing, not uploading, posts
function ProfileFeed({ channelId, isGroup, locationId }) {
    //const [hasMore, setHasMore] = useState(true);
    //const [isLoading, setIsLoading] = useState(false);
    //const limit = 10;
    //const [offset, setOffset] = useState(0)
    const [posts, setPosts] = useState([]);

    //Fetch limited number of posts in a profile channel
    //const getPosts = async () => {
        //if (!hasMore) return;
        //setIsLoading(true);
        //const response = await axios.get(`/api/profile_channel_posts/${locationId}/${channelId}?limit=${limit}&offset=${offset}`);
        //setPosts(prevPosts => [...prevPosts, ...response.data]);
        //setIsLoading(false);
        //if (response.data.length < limit) {
            //setHasMore(false);
        //}
        //setOffset(prevOffset => prevOffset + limit)
    //};

    //Infinite scroll
    //useEffect(() => {
        //const handleScroll = () => {
            //if (
                //window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight || isLoading
            //) return;
            //getPosts();
        //};
        //window.addEventListener('scroll', handleScroll);
        //return () => window.removeEventListener('scroll', handleScroll);
    //}, [isLoading]);

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