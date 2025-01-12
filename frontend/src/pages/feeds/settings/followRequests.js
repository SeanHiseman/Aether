import axios from 'axios';
import { FaPlusCircle, FaMinusCircle } from 'react-icons/fa';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FollowRequests = ({ feed, followRequests, setFeed, setFollowRequests, setRequestCount }) => {
    const [errorMessage, setErrorMessage] = useState('');

    const handleRequestAction = async (request, result) => {
        try {
            if (result === 'accept') {
                await axios.post('/api/accept_follow_request', { request });
                setFeed((prevFeed) => ({ ...prevFeed, follower_count: prevFeed.follower_count + 1 }));
            } else if (result === 'reject') {
                await axios.delete('/api/delete_follow_request', { data: { senderId: request.sender_id, receiverId: feed.feed_id } });
            }
            setFollowRequests((prevRequests) => {
                const updatedRequests = prevRequests.filter((prevRequest) => prevRequest.request_id !== request.request_id);
                setRequestCount(updatedRequests.length); 
                return updatedRequests;
            });
        } catch (error) {
            setErrorMessage('Error handling request');
        }
    };

    return (
        <div className="channel-content">
            <p className="text36">Follow Requests</p>
            {!followRequests || followRequests.length === 0 ? (
                <p>No pending requests</p>
            ) : (
                <ul className="content-list">
                    <div className="error-message">{errorMessage}</div>
                    {followRequests.map((request, index) => (
                        <li key={index}>
                            <div className="result-widget">
                                <Link className="feed-link" to={`/u/${request.sender.feed_name}`}>
                                    <img className="large-feed-photo" src={`/${request.sender.feed_photo}`} alt="Profile" />
                                    <p className="text36 feed-name">{request.sender.feed_name}</p>
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
                /*<ul>
                    <p>Group feeds</p>
                    {nestRequests.map((request) => (
                        <li key={request.request_id}>
                            {request.sender.groupName}
                            <button className="button" onClick={() => handleNestRequest("accept", request.request_id, request.sender_id)}>
                                Accept
                            </button>
                            <button className="button" onClick={() => handleNestRequest("reject", request.request_id)}>
                                Reject
                            </button>
                        </li>
                    ))}
                </ul>*/
            )}
        </div>
    );
};

export default FollowRequests;