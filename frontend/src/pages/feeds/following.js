import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../../components/contentWidget';

function FollowingPage() {
    const [posts, setPosts] = useState([]);

    //Gets posts from profiles and groups followed by user
    useEffect(() => {
        axios.get('/api/following_posts')
        .then(response => {
            setPosts(response.data);
        })
        .catch(error => {
             console.error('Error getting posts:', error);
        });
    }, []);

    document.title = "Following";
    return (
        <div className="home-container">
            <div className="content-feed">
                <div id="channel-content">
                    {posts.length > 0 ? (
                        <ul className="content-list">
                            {posts.map(post => (
                                <ContentWidget key={post.post_id} isGroup={post.isGroup} post={post}/>
                            ))}
                        </ul>
                        ) : (
                            <p>No posts yet</p>
                        )
                    }
                </div>
            </div>
            <aside id="right-aside">
                <h1>Following</h1>
            </aside>
        </div>
    )
}

export default FollowingPage;