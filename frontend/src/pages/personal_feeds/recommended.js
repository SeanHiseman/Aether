import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../../components/contentWidget';

const RecommendedPage = () => {
    const [posts, setPosts] = useState([]);
    const [filterPreference, setFilterPreference] = useState(0.5);
    const [timePreference, setTimePreference] = useState(0.001);

    //Posts recommended based on hybrid algorithm
    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await axios.get('/api/recommended_posts');
                setPosts(response.data.recommendations);
            } catch (error) {
                console.error('Error getting posts:', error);
            }
        };
        fetchPosts();
    }, []);
    
    //Load user's recommendation preference
    useEffect(() => {
        const fetchFilterPreference = async () => {
            try {
                const response = await axios.get('/api/get_filter_preference');
                setFilterPreference(response.data.preference);
            } catch (error) {
                console.error('Error getting preference:', error);
            }
        };
        fetchFilterPreference();
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

    //Save slider value to backend
    const handleSliderChange = (event) => {
        try {
            const newValue = parseFloat(event.target.value);
            setFilterPreference(newValue);
    
            axios.post('/api/set_filter_preference', { preference: newValue })

        } catch (error) {
            console.error(error);
        }
    };

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

    document.title = "Home";
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
                <h1>Recommended</h1>
                <label>Recommendations are similar to my friends:</label>
                <input type="range" min="0" max="1" step="0.01" value={filterPreference} onChange={handleSliderChange} />
                <label>Posts are recent:</label>
                <input type="range" min="0" max="0.01" step="0.00001" value={timePreference} onChange={handleTimeChange} />
            </aside>
        </div>
    )
}

export default RecommendedPage;