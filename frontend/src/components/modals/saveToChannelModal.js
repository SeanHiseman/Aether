import api from '../../api';
import { AuthContext } from '../authContext';
import { FaTimes } from 'react-icons/fa';
import { useContext, useEffect, useState } from 'react';

const SaveToChannelModal = ({ post, isExternal = false, onClose, onSaveComplete }) => {
    const [channels, setChannels] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedChannels, setSelectedChannels] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const { viewer } = useContext(AuthContext);

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        setLoading(true);
        try {
            //Try to load from cache first
            const cached = localStorage.getItem('savedChannels');
            let fetchedChannels = [];
            if (cached) {
                try {
                    fetchedChannels = JSON.parse(cached);
                    setChannels(fetchedChannels);
                } catch (e) {
                    //Invalid cache, will fetch from server
                }
            }

            //Fetch from server in background to ensure fresh data
            const response = await api.get('/get_feed_channels/saved');
            fetchedChannels = response.data?.channels || [];
            setChannels(fetchedChannels);
            localStorage.setItem('savedChannels', JSON.stringify(fetchedChannels));

            //Check which channels this post is already saved to
            const savedResponse = await api.get('/get_post_saved_channels', {
                params: {
                    postId: post.post_id,
                    isExternal
                }
            });
            const savedChannelIds = savedResponse.data?.channelIds || [];

            //If post is not saved yet, default to Main channel
            if (savedChannelIds.length === 0) {
                const mainChannel = fetchedChannels.find(c => c.channel_name === 'Main');
                if (mainChannel) {
                    setSelectedChannels([mainChannel.channel_id]);
                }
            } else {
                setSelectedChannels(savedChannelIds);
            }
        } catch (error) {
            //If no channels exist yet, create Main channel
            if (error.response?.status === 404 || error.response?.data?.channels?.length === 0) {
                try {
                    const createResponse = await api.post('/add_feed_channel', {
                        channelName: 'Main',
                        isSaved: true
                    });
                    const newChannel = createResponse.data?.newChannel;
                    if (newChannel) {
                        setChannels([newChannel]);
                        setSelectedChannels([newChannel.channel_id]);
                        localStorage.setItem('savedChannels', JSON.stringify([newChannel]));
                    }
                } catch (createError) {
                    setErrorMessage(createError.response?.data?.message || 'Error creating saved posts channel');
                    setTimeout(() => setErrorMessage(''), 5000);
                }
            } else {
                setErrorMessage(error.response?.data?.message || 'Error fetching channels');
                setTimeout(() => setErrorMessage(''), 5000);
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleChannelSelection = (channelId) => {
        const channel = channels.find(c => c.channel_id === channelId);
        const isMainChannel = channel?.channel_name === 'Main';
        const mainChannel = channels.find(c => c.channel_name === 'Main');

        setSelectedChannels(prev => {
            if (prev.includes(channelId)) {
                //If unselecting Main channel, unselect all channels
                if (isMainChannel) {
                    return [];
                }
                //Otherwise, just remove this channel
                return prev.filter(id => id !== channelId);
            } else {
                //If selecting a non-Main channel, auto-select Main too
                if (!isMainChannel && mainChannel && !prev.includes(mainChannel.channel_id)) {
                    return [...prev, mainChannel.channel_id, channelId];
                }
                return [...prev, channelId];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await api.post('/save_post_to_channels', {
                postId: post.post_id,
                channelIds: selectedChannels,
                isExternal,
                feedId: viewer?.feed_id,
                channelId: post.parentChannel?.channel_id || post.channel_id
            });

            if (response.data?.success) {
                //Notify parent component
                if (onSaveComplete) {
                    onSaveComplete(selectedChannels.length > 0);
                }
                onClose();
            } else {
                setErrorMessage(response.data?.message || 'Error saving post');
                setTimeout(() => setErrorMessage(''), 5000);
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error saving post');
            setTimeout(() => setErrorMessage(''), 5000);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content share-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Save Post</h2>
                    <button className="modal-close" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <div className="modal-body">
                    {loading ? (
                        <p className="small-text faded-text">Loading channels...</p>
                    ) : channels.length === 0 ? (
                        <p className="small-text faded-text">No channels available</p>
                    ) : (
                        <div className="save-channels-list">
                            <p className="small-text">Select channels to save this post to:</p>
                            {channels.map(channel => (
                                <label key={channel.channel_id} className="share-chat-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedChannels.includes(channel.channel_id)}
                                        onChange={() => toggleChannelSelection(channel.channel_id)}
                                    />
                                    <span className="small-text">{channel.channel_name}</span>
                                </label>
                            ))}
                            <p className="tiny-text faded-text" style={{ marginTop: '12px' }}>
                                Note: All saved posts are saved to Main by default. Unselecting Main will unsave the post entirely.
                            </p>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="secondary-button" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="main-button"
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        {saving
                            ? 'Saving...'
                            : selectedChannels.length === 0
                            ? 'Unsave Post'
                            : `Save to ${selectedChannels.length} ${selectedChannels.length === 1 ? 'channel' : 'channels'}`
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaveToChannelModal;
