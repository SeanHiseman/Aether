import api from '../../api';
import { AuthContext } from '../authContext';
import { FaChevronDown, FaChevronUp, FaTimes } from 'react-icons/fa';
import { useContext, useEffect, useState } from 'react';
import { ValidateTextInput } from '../../functions/validateTextInput';

const SharePostModal = ({ post, onClose }) => {
    const [connections, setConnections] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [expandedConnection, setExpandedConnection] = useState(null);
    const [connectionChats, setConnectionChats] = useState({});
    const [loadingChats, setLoadingChats] = useState({});
    const [message, setMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChats, setSelectedChats] = useState([]);
    const [sending, setSending] = useState(false);
    const [validationError, setValidationError] = useState('');
    const { user, viewer } = useContext(AuthContext);
    const maxLength = user?.has_membership ? 10000 : 1000;

    useEffect(() => {
        const storedConnections = localStorage.getItem('connections');
        if (storedConnections) {
            const parsed = JSON.parse(storedConnections);
            setConnections(parsed);
        } else {
            fetchConnections();
        }
    }, []);

    const fetchConnections = async () => {
        try {
            const response = await api.get('/get_connections', {
                params: { feedId: viewer?.feed_id, offset: 0 }
            });
            setConnections(response.data?.connections || []);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error fetching connections');
            setTimeout(() => setErrorMessage(''), 5000);
        }
    };

    const fetchChatsForConnection = async (connectionFeedId, connectionName) => {
        if (connectionChats[connectionFeedId]) {
            return;
        }
        const storedChats = localStorage.getItem('connectionChats');
        if (storedChats) {
            const parsed = JSON.parse(storedChats);
            if (parsed[connectionFeedId]) {
                setConnectionChats(prev => ({
                    ...prev,
                    [connectionFeedId]: parsed[connectionFeedId]
                }));
                return; 
            }
        }
        //API fallback if localStorage fails
        setLoadingChats(prev => ({ ...prev, [connectionFeedId]: true }));
        try {
            const response = await api.get(`/get_chats/${viewer?.feed_id}`, {
                params: { connectionName }
            });
            const chats = response.data?.chats || [];
            setConnectionChats(prev => ({
                ...prev,
                [connectionFeedId]: chats
            }));
            //Save to localStorage
            const existingChats = localStorage.getItem('connectionChats');
            const parsed = existingChats ? JSON.parse(existingChats) : {};
            parsed[connectionFeedId] = chats;
            localStorage.setItem('connectionChats', JSON.stringify(parsed));
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error fetching chats');
            setTimeout(() => setErrorMessage(''), 5000);
        } finally {
            setLoadingChats(prev => ({ ...prev, [connectionFeedId]: false }));
        }
    };

    const toggleConnection = async (connection, e) => {
        //If clicking the chevron/expand button, just expand/collapse
        if (e?.target?.closest('.expand-icon')) {
            if (expandedConnection === connection.feed_id) {
                setExpandedConnection(null);
            } else {
                setExpandedConnection(connection.feed_id);
                await fetchChatsForConnection(connection.feed_id, connection.feed_name);
            }
            return;
        }
        //If clicking the connection itself, select/deselect the Main chat
        //First check if chats are already loaded
        let chats = connectionChats[connection.feed_id];
        //If not loaded, fetch them
        if (!chats) {
            await fetchChatsForConnection(connection.feed_id, connection.feed_name);
            //After fetch completes, get the chats from state
            //We need to check localStorage since state might not be updated yet
            const storedChats = localStorage.getItem('connectionChats');
            if (storedChats) {
                const parsed = JSON.parse(storedChats);
                chats = parsed[connection.feed_id];
            }
        }
        //Now select the Main chat
        if (chats && chats.length > 0) {
            const mainChat = chats.find(c => c.title === 'Main');
            if (mainChat) {
                toggleChatSelection(mainChat, connection.feed_id);
            }
        }
    };

    const toggleChatSelection = (chat, connectionFeedId) => {
        const chatKey = `${connectionFeedId}-${chat.chat_id}`;
        const existingIndex = selectedChats.findIndex(
            sc => sc.chat_id === chat.chat_id && sc.receiver_id === connectionFeedId
        );
        if (existingIndex >= 0) {
            setSelectedChats(prev => prev.filter((_, idx) => idx !== existingIndex));
        } else {
            setSelectedChats(prev => [
                ...prev,
                {
                    chat_id: chat.chat_id,
                    receiver_id: connectionFeedId,
                    chat_title: chat.title,
                    connection_name: connections.find(c => c.feed_id === connectionFeedId)?.feed_name
                }
            ]);
        }
    };

    const isChatSelected = (chatId, connectionFeedId) => {
        return selectedChats.some(
            sc => sc.chat_id === chatId && sc.receiver_id === connectionFeedId
        );
    };

    const handleSend = async () => {
        if (selectedChats.length === 0) {
            setErrorMessage('Please select at least one chat');
            setTimeout(() => setErrorMessage(''), 5000);
            return;
        }
        const validation = ValidateTextInput(message, 0, maxLength, false);
        if (!validation.valid) {
            setErrorMessage(validation.error);
            setTimeout(() => setErrorMessage(''), 5000);
            return;
        }
        setSending(true);
        try {
            const shares = selectedChats.map(sc => ({
                chat_id: sc.chat_id,
                receiver_id: sc.receiver_id
            }));
            const response = await api.post('/send_shared_post', {
                post_id: post.post_id,
                shares,
                sender_id: viewer?.feed_id,
                message_text: message.trim() || null
            });
            if (response.data?.success) {
                onClose();
            } else {
                setErrorMessage(response.data?.message || 'Error sharing post');
                setTimeout(() => setErrorMessage(''), 5000);
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error sharing post');
            setTimeout(() => setErrorMessage(''), 5000);
        } finally {
            setSending(false);
        }
    };

    const filteredConnections = connections.filter(c =>
        c.feed_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content share-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Share Post</h2>
                    <button className="modal-close" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <div className="modal-body">
                    <input type="text" className="input" placeholder="Search connections..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <div className="share-connections-list">
                        {filteredConnections.length === 0 ? (
                            <p className="small-text faded-text">No connections found</p>
                        ) : (
                            filteredConnections.map(connection => (
                                <div key={connection.feed_id}>
                                    <div className="share-connection-item" onClick={(e) => toggleConnection(connection, e)}>
                                        <img className="small-feed-photo" src={connection.feed_photo} onError={e => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                                        <span className="small-text">{connection.feed_name}</span>
                                        <div className="ml-auto expand-icon">
                                            {expandedConnection === connection.feed_id ? (
                                                <FaChevronUp />
                                            ) : (
                                                <FaChevronDown />
                                            )}
                                        </div>
                                    </div>
                                    {expandedConnection === connection.feed_id && (
                                        <div className="share-chats-list">
                                            {loadingChats[connection.feed_id] ? (
                                                <p className="small-text faded-text">Loading chats...</p>
                                            ) : connectionChats[connection.feed_id]?.length === 0 ? (
                                                <p className="small-text faded-text">No chats available</p>
                                            ) : (
                                                connectionChats[connection.feed_id]?.map(chat => (
                                                    <label key={chat.chat_id} className="share-chat-checkbox">
                                                        <input type="checkbox" checked={isChatSelected(chat.chat_id, connection.feed_id)} onChange={() => toggleChatSelection(chat, connection.feed_id)}/>
                                                        <span className="small-text">{chat.title}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="share-message-input">
                        <label className="small-text">Add a message (optional)</label>
                            <textarea
                                className="input"
                                placeholder="Say something about this post..."
                                value={message}
                                onChange={e => {
                                    const input = e.target.value;
                                    const validation = ValidateTextInput(input, 0, maxLength, false);
                                    if (!validation.valid) {
                                        setValidationError(validation.error);
                                        if (input.length > maxLength) {
                                            return;
                                        }
                                    } else {
                                        setValidationError('');
                                    }
                                    setMessage(input);
                                }}
                                rows={3}
                            />
                            <p className="tiny-text faded-text">
                                {message.length}/{maxLength}
                            </p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="secondary-button" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="main-button"
                        onClick={handleSend}
                        disabled={selectedChats.length === 0 || sending}
                    >
                        {sending
                            ? 'Sharing...'
                            : `Share to ${selectedChats.length} ${selectedChats.length === 1 ? 'chat' : 'chats'}`
                        }
                    </button>
                </div>
                {selectedChats.length > 0 && (
                    <div className="selected-chats-summary">
                        <p className="small-text">Selected:</p>
                        <div className="selected-chats-tags">
                            {selectedChats.map((sc, idx) => (
                                <span key={idx} className="chat-tag">
                                    {sc.connection_name} - {sc.chat_title}
                                    <FaTimes
                                        className="remove-tag"
                                        onClick={() => toggleChatSelection(
                                            { chat_id: sc.chat_id, title: sc.chat_title },
                                            sc.receiver_id
                                        )}
                                    />
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SharePostModal;