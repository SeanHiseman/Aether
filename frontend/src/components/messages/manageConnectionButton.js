import api from '../../api';
import ConfirmModal from '../modals/confirmModal';
import { FaUserMinus, FaUserPlus } from 'react-icons/fa';
import { useEffect, useState } from 'react';

const ManageConnectionButton = ({ connectRequest, feed, isConnected, viewerId, onRequestUpdate, updateFeeds }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [hasConnection, setHasConnection] = useState(isConnected || feed.isConnected);
    const [request, setRequest] = useState(connectRequest || feed.connectRequest);
    const senderId = request?.sender_id || viewerId;
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const receiverId = request?.receiver_id || feed?.feed_id;

    useEffect(() => {
        setHasConnection(isConnected || feed.isConnected)
        setRequest(connectRequest || feed.connectRequest);
    }, [connectRequest, feed.connectRequest, isConnected, feed.isConnected]);

    const handleConnectRequest = async (result) => {
        try {
            let response;
            if (result === 'accept') {
                response = await api.post('/accept_connect_request', {
                    receiverId: viewerId,
                    senderId
                });
                if (response.status === 200) {
                    const storedFollowedFeeds = JSON.parse(localStorage.getItem('followedFeeds')) || [];
                    const alreadyFollowing = storedFollowedFeeds.some(f => f.feed_id === senderId);
                    if (!alreadyFollowing) {
                        storedFollowedFeeds.push({
                            feed_id: senderId,
                            feed_name: feed.feed_name,
                            feed_photo: feed.feed_photo,
                            is_group: feed.is_group
                        });
                        localStorage.setItem('followedFeeds', JSON.stringify(storedFollowedFeeds));
                    }
                    setHasConnection(true);
                    setRequest(null);
                    if (onRequestUpdate) {
                        onRequestUpdate(senderId);
                    }
                    if (updateFeeds) {
                        updateFeeds();
                    }
                }
            } else if (result === 'reject') {
                response = await api.delete('/delete_connect_request', {
                    data: { receiverId: viewerId, senderId }
                });
                if (response.status === 200) {
                    setRequest(null);
                    if (onRequestUpdate) {
                        onRequestUpdate(null, senderId);
                    }
                }
            }
        } catch (error) {
            setErrorMessage("Error handling request");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }; 

    const handleSendRequest = async () => {
        try {
            let method, requestData, url;
            const targetFeedId = viewerId === senderId ? receiverId : senderId;
            if (hasConnection) {
                method = 'delete';
                url = '/delete_connection';
                requestData = { deleterId: viewerId, feedId: targetFeedId };
            } 
            else if (request) {
                method = 'delete';
                url = '/delete_connect_request';
                requestData = { 
                    receiverId: viewerId === senderId ? receiverId : viewerId, 
                    senderId: viewerId === senderId ? viewerId : senderId 
                };
            } 
            else {
                method = 'post';
                url = '/send_connect_request';
                requestData = { receiverId, senderId: viewerId };
            }
            const response = await api({ 
                method, 
                url, 
                data: requestData 
            });
            if (response.status === 200) {
                if (method === 'delete') {
                    setHasConnection(false);
                    setRequest(null);
                    if (onRequestUpdate) {
                        onRequestUpdate(targetFeedId);
                    }
                } else {
                    setRequest(true);
                    setHasConnection(false);
                }
            }
        } catch (error) {
            setErrorMessage("Connection handling error");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };   

    if ((viewerId === receiverId) && request && !hasConnection) {
        return (
            <><button className="small-icon" onClick={() => handleConnectRequest('accept')}>
                <FaUserPlus /><p className="icon-text">Accept</p>
            </button>
            <button className="small-icon" onClick={() => handleConnectRequest('reject')}>
                <FaUserMinus /><p className="icon-text">Reject</p>
            </button>
            {errorMessage && <div className="error-message">{errorMessage}</div>}</>
        );
    }

    return (
        <><button className="small-icon" onClick={() => { if (hasConnection) {setShowDisconnectConfirm(true)} else {handleSendRequest()}}}>
        {hasConnection ? (
            <>
                <FaUserMinus /><p className="icon-text">Disconnect</p>
            </>
        ) : request ? (
            <>
                <FaUserMinus /><p className="icon-text">Cancel request</p>
            </>
        ) : (
            <>
                <FaUserPlus /><p className="icon-text">Connect</p>
            </>
        )}
        </button>
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        <ConfirmModal
            isOpen={showDisconnectConfirm}
            onConfirm={() => {
                setShowDisconnectConfirm(false);
                handleSendRequest();
            } }
            onCancel={() => setShowDisconnectConfirm(false)}
            title="Disconnect Confirmation"
            message={`Are you sure you want to disconnect from ${feed?.feed_name}?`} />
        </>
    );
}

export default ManageConnectionButton;