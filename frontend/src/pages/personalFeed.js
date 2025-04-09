import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentWidget from '../components/content/contentWidget';

const PersonalFeed = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const { feed_name } = useParams();
    const [posts, setPosts] = useState([]);
    const [timePreference, setTimePreference] = useState(0.001);

    //Gets posts from profiles and groups followed by user
    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await axios.get(`/api/${feed_name}_posts`);
                setPosts(response.data);
            } catch (error) {
                setErrorMessage('Error getting posts');
            }
        };
        fetchPosts();
    }, [feed_name]);
    
    //Load user's time preference
    useEffect(() => {
        const fetchTimePreference = async () => {
            try {
                const response = await axios.get('/api/get_time_preference');
                setTimePreference(response.data.preference);
            } catch (error) {
                setErrorMessage('Error getting preference');
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
            setErrorMessage('Error changing preference');
        }
    };

    document.title = `${feed_name}`;
    return (
        <div className="standard-container">
            <div className="content-feed">
                <div className="channel-content">
                    {/*{posts.length > 0 ? (
                        <ul className="content-list">
                            {posts.map(post => (
                                <ContentWidget key={post.post_id} isGroup={post.is_group} post={post}/>
                            ))}
                        </ul>
                        ) : (
                            <p>No posts yet</p>
                        )
                    }*/}
                </div>
            </div>
            <aside className="right-aside">
                <h1>Coming soon!</h1>
                {/*<h1>Following</h1>
                <label>Posts are recent:</label>
                <input type="range" min="0" max="0.001" step="0.00001" value={timePreference} onChange={handleTimeChange} />
                <div className="error-message">{errorMessage}</div>*/}
            </aside>
        </div>
    )
}

export default PersonalFeed;