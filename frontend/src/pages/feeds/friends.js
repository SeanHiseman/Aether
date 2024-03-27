import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../../components/contentWidget';

function FriendsPage() {
    const [posts, setPosts] = useState([]);

    //Gets friend posts
    useEffect(() => {
        axios.get('/api/friend_posts')
        .then(response => {
            setPosts(response.data);
        })
        .catch(error => {
             console.error('Error getting posts:', error);
        });
    }, []);

    document.title = "Friends";
    return (
        <div className="home-container">
            <div className="content-feed">
                <div id="channel-content">
                        {posts.length > 0 ? (
                            <ul className="content-list">
                                {posts.map(post => (
                                    <ContentWidget key={post.post_id} isGroup={false} post={post}/>
                                ))}
                            </ul>
                        ) : (
                            <p>No posts yet</p>
                        )
                    }
                </div>
            </div>
            <aside id="right-aside">
                <h1>Friends</h1>
            </aside>
        </div>
    )
}

export default FriendsPage;