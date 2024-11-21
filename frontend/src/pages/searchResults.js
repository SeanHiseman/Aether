import { AuthContext } from '../components/authContext';
import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContentWidget from '../components/contentWidget';
import FeedWidget from '../components/search/feedWidget';

const SearchResults = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [feeds, setFeeds] = useState([]);
    const [posts, setPosts] = useState([]);
    const [selectedView, setSelectedView] = useState('combined');
    const [searchParams] = useSearchParams();
    const keyword = (searchParams.get('keyword') || '').trim();
    const [timePreference, setTimePreference] = useState(0.001);
    const { user, viewer } = useContext(AuthContext);

    //Gets results depending on which type is being viewed
    useEffect(() => {
        const fetchResults = async () => {
            const searcherId = viewer.feed_id;
            try {
                const response = await axios.get(`/api/search/${searcherId}?keyword=${keyword}`);
                setFeeds(response.data.feeds);
                //setPosts(response.data.posts);
            } catch (error) {
                setErrorMessage('Error getting search results');
            }
        };
        if (keyword) {
            fetchResults();
        }
    }, [keyword]);

    //Load user's time preference
    //useEffect(() => {
        //const getTimePreference = async () => {
            //try {
                //const response = axios.get('/api/get_time_preference');
                //setTimePreference(response.data.preference);
            //} catch (error) {
                //console.error('Error getting preference:', error);
            //}
        //}
        //getTimePreference();
    //}, []);

    //Save time value to backend
    const handleTimeChange = (event) => {
        try {
            const newValue = parseFloat(event.target.value);
            setTimePreference(newValue);
            axios.post('/api/set_time_preference', { preference: newValue })
            //setTimePreference(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    const renderResults = () => {
        switch (selectedView) {
            case 'posts':
                return posts.length > 0 ? (
                    posts.map((post) => (
                        <ContentWidget key={post.post_id} post={post} isGroup={post.is_group} />
                    ))
                ) : (
                    <div>No posts found.</div>
                );
            case 'feeds':
                return feeds.length > 0 ? (
                    feeds.map((feed) => (
                        <FeedWidget key={feed.feed_id} feed={feed} viewerId={viewer.feed_id} />
                    ))
                ) : (
                    <div>No feeds found.</div>
                );
            case 'combined':
            default:
                return (
                    <>
                        {feeds.length > 0 && feeds.map((feed) => (
                            <FeedWidget key={feed.feed_id} feed={feed} viewerId={viewer.feed_id} />
                        ))}
                        {posts.length > 0 && posts.map((post) => (
                            <ContentWidget key={post.post_id} post={post} isGroup={post.is_group} />
                        ))}
                    </>
                );
        }
    };

    document.title = 'Search';
    return (
        <div className="results-container">
            <div className="content-feed">
                <div className="channel-content">
                    <ul className="content-list">
                        {renderResults()}
                    </ul>
                </div>
            </div>
            <div id="right-aside">
                <h1>Results</h1>
                <div className="error-message">{errorMessage}</div>
                <nav id="channel-list">
                    <ul>
                        <li className="channel-link" onClick={() => setSelectedView('combined')}>All</li>
                        <li className="channel-link" onClick={() => setSelectedView('posts')}>Posts</li>
                        <li className="channel-link" onClick={() => setSelectedView('feeds')}>Feeds</li>
                        <label>Posts are recent:</label>
                        <input type="range" min="0" max="0.01" step="0.00001" value={timePreference} onChange={handleTimeChange} />
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default SearchResults;
