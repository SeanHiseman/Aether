import api from '../../../api';
import { AuthContext } from '../../../components/authContext';
import { useContext, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

const FeedDeletion = () => {
    const [confirmText, setConfirmText] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isDisabled, setIsDisabled] = useState(true);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { feed, updateFeeds } = useOutletContext();
    const { isAuthenticated, user } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleDeleteClick = () => {
        setShowConfirmation(true);
    };

    const deleteFeed = async () => {
        try {
            setIsDisabled(true);
            if (!feed?.is_group && isAuthenticated && user?.user_id) {
                await api.post('/feedback', {
                    isDeletion: true,
                    message: confirmText,
                    userId: user?.user_id
                });
            }
            const response = feed?.is_group ?
                await api.delete('/delete_feed', { data: { feedId: feed?.feed_id } }) :
                await api.delete('/delete_account', { data: { userId: feed?.feed_owner } });
            if (response.data?.success) {
                if (feed?.is_group) {
                    const stored = JSON.parse(localStorage.getItem("followedFeeds")) || [];
                    const updated = stored.filter(f => f.feed_id !== feed?.feed_id);
                    localStorage.setItem("followedFeeds", JSON.stringify(updated));
                    updateFeeds();
                } else {
                    localStorage.clear();
                }
                const route = feed?.is_group ? '/explore' : '/join';
                setTimeout(() => navigate(route), 0);
            }
        } catch (error) {
            setIsDisabled(false);
            setErrorMessage(error.response?.data?.message || 'Error deleting feed');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
        setShowConfirmation(false);
        setConfirmText('');
        setIsDisabled(true);
    };

    const cancelDeletion = () => {
        setIsDisabled(true);
        setShowConfirmation(false);
        setConfirmText('');
    };

    document.title = feed?.is_group ? "Delete Feed" : "Delete Account";

    return (
        <div className="feed-settings">
            <div className="display-area" style={{ alignItems: 'start' }}>
                <p className="large-text" style={{ fontWeight: 'bold', marginBottom: '30px' }}>
                    {feed?.is_group ? 'Are you sure you wish to delete this feed?' : 'Are you sure you wish to delete your account?'}
                </p>
                <p className="medium-text" style={{ alignSelf: 'start' }}>
                    This action cannot be reversed
                </p>
                <p className="medium-text" style={{ alignSelf: 'start', marginBottom: '30px' }}>
                    All posts, channels, followers and feed information will be lost
                </p>
                {!showConfirmation ? (
                    <button className="button delete" onClick={handleDeleteClick}>
                        {feed?.is_group ? 'Delete Feed' : 'Delete Account'}
                    </button>
                ) : (
                    <div className="confirmation-dialog">
                        <p className="medium-text" style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '15px' }}>
                            Final Confirmation Required
                        </p>
                        <p className="small-text" style={{ marginBottom: '20px' }}>
                            {feed?.is_group ? 'Type DELETE to confirm.' : 'Let us know why you are leaving.'}
                        </p>
                        {feed?.is_group ? (
                            <input
                                type="text"
                                className="name-input"
                                placeholder="Type DELETE"
                                value={confirmText}
                                style={{ marginBottom: '15px', padding: '8px', maxWidth: '300px', width: '90vw' }}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setConfirmText(value);
                                    setIsDisabled(value.trim().toLowerCase() !== 'delete');
                                }}
                            />
                        ) : (
                            <textarea
                                className="name-input"
                                placeholder="Your feedback (minimum 10 characters)"
                                value={confirmText}
                                style={{ marginBottom: '15px', padding: '8px', maxWidth: '300px', width: '90vw', minHeight: '80px' }}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setConfirmText(value);
                                    setIsDisabled(value.trim().length < 10);
                                }}
                            />
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className={`button delete${isDisabled ? ' disabled' : ''}`}
                                onClick={deleteFeed}
                                disabled={isDisabled}
                                style={{ opacity: isDisabled ? 0.5 : 1 }}
                            >
                                Confirm {feed?.is_group ? 'Delete Feed' : 'Delete Account'}
                            </button>
                            <button className="large-icon" onClick={cancelDeletion}>
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