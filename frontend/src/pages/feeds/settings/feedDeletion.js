import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FeedDeletion = ({ feed }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const deleteFeed = async () => {
        try {
            const response = await axios.delete('/api/delete_feed', { data: { feedId: feed.feed_id } });
                if (response.data.success) {
                    navigate('/recommended');
                }
        } catch (error) {
            setErrorMessage('Error deleting feed');
        }
    };

    return (
        <div className="feed-settings">
            <div className="display-area">
                <p className="text36">Are you sure you wish to delete this feed?</p>
                <p className="text24">This action cannot be reversed</p>
                <p className="text24">All posts, channels, followers and feed information will be lost</p>
                <button className="button delete" onClick={deleteFeed}>Delete feed</button>
                <div className="error-message">{errorMessage}</div>
            </div>
        </div>
    );
};

export default FeedDeletion;