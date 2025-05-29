import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

const FeedDeletion = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const { feed } = useOutletContext();
    const navigate = useNavigate();

    const deleteFeed = async () => {
        try {
            const response = feed.is_group ? await axios.delete('/api/delete_feed', { data: { feedId: feed.feed_id } }) : await axios.delete('/api/delete_account', { data: { userId: feed.feed_owner } });
                if (response.data.success) {
                    const route = feed.is_group ? '/d/following' : '/join';
                    navigate(route);
                }
        } catch (error) {
            setErrorMessage('Error deleting feed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="feed-settings">
            <div className="display-area">
                <p className="text36">{feed.is_group ? 'Are you sure you wish to delete this feed?' : 'Are you sure you wish to delete your account?'}</p>
                <p className="text24">This action cannot be reversed</p>
                <p className="text24">All posts, channels, followers and feed information will be lost</p>
                <button className="button delete" onClick={deleteFeed}>{feed.is_group ? 'Delete Feed' : 'Delete Account'}</button>
                <div className="error-message">{errorMessage}</div>
            </div>
        </div>
    );
};

export default FeedDeletion;