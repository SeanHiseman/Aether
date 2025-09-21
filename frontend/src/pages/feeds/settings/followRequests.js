import axios from 'axios';
import { FaPlusCircle, FaMinusCircle } from 'react-icons/fa';
import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { FormatNumber } from '../../../functions/formatNumber';

const FollowRequests = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const { feed, followRequests, setFeed, setFollowRequests, setFollowRequestCount } = useOutletContext();

    const handleRequestAction = async (request, result) => {
        try {
            if (result === 'accept') {
                await axios.post('/api/accept_follow_request', { request });
                setFeed((prevFeed) => ({ ...prevFeed, follower_count: prevFeed?.follower_count + 1 }));
            } else if (result === 'reject') {
                await axios.delete('/api/delete_follow_request', { data: { senderId: request.sender_id, receiverId: feed?.feed_id } });
            }
            setFollowRequests((prevRequests) => {
                const updatedRequests = prevRequests.filter((prevRequest) => prevRequest?.request_id !== request?.request_id);
                setFollowRequestCount(updatedRequests.length);
                return updatedRequests;
            });
        } catch (error) {
            setErrorMessage('Error handling request');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="channel-content">
            <p className="large-text">{FormatNumber(followRequests.length)} {followRequests.length === 1 ? 'follow request' : 'follow requests'}</p>
            {!followRequests || followRequests.length === 0 ? (
                <p className="medium-text faded-text">No pending requests</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {followRequests.map((request, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="feed-link" to={`/u/${request?.sender?.feed_name}`}>
                                    <img className="large-feed-photo" src={`/${request?.sender?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                                    <p className="large-text feed-name">{request?.sender?.feed_name}</p>
                                </Link>
                                <div>
                                    <button className="small-icon" onClick={() => handleRequestAction(request, 'accept')}>
                                        <FaPlusCircle /><p className="icon-text">Accept</p>
                                    </button>
                                    <button className="small-icon" onClick={() => handleRequestAction(request, 'reject')}>
                                        <FaMinusCircle /><p className="icon-text">Reject</p>
                                    </button>
                                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default FollowRequests;