import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

const FeedDeletion = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const { feed } = useOutletContext();
    const navigate = useNavigate();

    const handleDeleteClick = () => {
        setShowConfirmation(true);
    };

    const deleteFeed = async () => {
        try {
            const response = feed.is_group ? 
                await axios.delete('/api/delete_feed', { data: { feedId: feed.feed_id } }) : 
                await axios.delete('/api/delete_account', { data: { userId: feed.feed_owner } });
            if (response.data.success) {
                const route = feed.is_group ? '/d/following' : '/join';
                navigate(route);
            }
        } catch (error) {
            setErrorMessage('Error deleting feed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
        setShowConfirmation(false);
        setConfirmText('');
    };

    const cancelDeletion = () => {
        setShowConfirmation(false);
        setConfirmText('');
    };

    return (
        <div className="feed-settings short">
            <div className="display-area">
                <p className="text36">{feed.is_group ? 'Are you sure you wish to delete this feed?' : 'Are you sure you wish to delete your account?'}</p>
                <p className="text24">This action cannot be reversed</p>
                <p className="text24">All posts, channels, followers and feed information will be lost</p>
                {!showConfirmation ? (
                    <button className="button delete" onClick={handleDeleteClick}>
                        {feed.is_group ? 'Delete Feed' : 'Delete Account'}
                    </button>
                ) : (
                    <div className="confirmation-dialog">
                        <p className="text20" style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '15px' }}>
                            Final Confirmation Required
                        </p>
                        <p className="text18" style={{ marginBottom: '20px' }}>
                            Type "DELETE" to confirm this permanent action:
                        </p>
                        <input 
                            type="text" 
                            className="name-input"
                            placeholder="Type DELETE to confirm"
                            value={confirmText}
                            style={{ marginBottom: '15px', padding: '8px', width: '200px' }}
                            onChange={(e) => setConfirmText(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                className="button delete" 
                                onClick={deleteFeed}
                                disabled={confirmText !== 'DELETE'}
                                style={{ opacity: confirmText !== 'DELETE' ? 0.5 : 1 }}
                            >
                                Confirm {feed.is_group ? 'Delete Feed' : 'Delete Account'}
                            </button>
                            <button className="button" onClick={cancelDeletion}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                <div className="error-message">{errorMessage}</div>
            </div>
        </div>
    );
};

export default FeedDeletion;