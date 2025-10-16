import api from '../../../api';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FormatNumber } from '../../../functions/formatNumber';
import FollowerWidget from './followerWidget';

const FollowRequests = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const { feed, followRequests, setFeed, setFollowRequests, setFollowRequestCount } = useOutletContext();

    const handleRequestAction = async (request, result) => {
        try {
            if (result === 'accept') {
                await api.post('/accept_follow_request', { request });
                setFeed((prevFeed) => ({ ...prevFeed, follower_count: prevFeed?.follower_count + 1 }));
            } else if (result === 'reject') {
                await api.delete('/delete_follow_request', { data: { senderId: request.sender_id, receiverId: feed?.feed_id } });
            }
            setFollowRequests((prevRequests) => {
                const updatedRequests = prevRequests.filter((prevRequest) => prevRequest?.request_id !== request?.request_id);
                setFollowRequestCount(updatedRequests.length);
                return updatedRequests;
            });
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error handling request');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="channel-content">
            <p className="large-text bold">{FormatNumber(followRequests.length)} {followRequests.length === 1 ? 'follow request' : 'follow requests'}</p>
            {(!followRequests || followRequests.length === 0) ? (
                <p className="medium-text faded-text">No pending requests</p>
            ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full">
                    {followRequests.map((request, idx) => (
                        <FollowerWidget
                            key={request?.request_id || `request-${idx}`}
                            follower={{
                                followerFeed: request?.sender,
                                follower_id: request?.sender_id
                            }}
                            feed={feed}
                            user={{}} 
                            acceptRequest={() => handleRequestAction(request, 'accept')}
                            rejectRequest={() => handleRequestAction(request, 'reject')}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FollowRequests;