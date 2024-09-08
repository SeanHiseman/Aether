import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../../components/contentWidget';

const PersonalFeedPage = () => {
    const [posts, setPosts] = useState([]);
    const [timePreference, setTimePreference] = useState(0.001);

    //Gets posts from profiles and groups followed by user
    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await axios.get('/api/following_posts');
                setPosts(response.data);
            } catch (error) {
                console.error('Error getting posts:', error);
            }
        };
        fetchPosts();
    }, []);
    
    //Load user's time preference
    useEffect(() => {
        const fetchTimePreference = async () => {
            try {
                const response = await axios.get('/api/get_time_preference');
                setTimePreference(response.data.preference);
            } catch (error) {
                console.error('Error getting preference:', error);
            }
        };
        fetchTimePreference();
    }, []);
    

    //Save time value to backend
    const handleTimeChange = (event) => {
        try {
            const newValue = parseFloat(event.target.value);
            setTimePreference(newValue);
    
            axios.post('/api/set_time_preference', { preference: newValue })
        } catch (error) {
            console.error(error);
        }
    };

    document.title = "Following";
    return (
        <div className="home-container">
            <div className="content-feed">
                <div className="channel-content">
                    {posts.length > 0 ? (
                        <ul className="content-list">
                            {posts.map(post => (
                                <ContentWidget key={post.post_id} isGroup={post.is_group} post={post}/>
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
                <label>Posts are recent:</label>
                <input type="range" min="0" max="0.001" step="0.00001" value={timePreference} onChange={handleTimeChange} />
            </aside>
        </div>
    )
}

export default PersonalFeedPage;