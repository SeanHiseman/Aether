import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const ChannelList = ({ channels, feedId, feedName, isGroup, setChannels }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const urlLetter = isGroup ? 'g' : 'u';

    const getFeedChannels = useCallback(async () => {
        try {
            const channelRoute = isGroup ? 'get_group_channels' : 'get_profile_channels';
            const response = await axios.get(`/api/${channelRoute}/${feedId}`);
            setChannels(response.data);
        } catch (error) {
            setErrorMessage('Error getting channels');
            setChannels([]);
        }
    }, [feedId, isGroup]);

    useEffect(() => {
        getFeedChannels();
    }, [getFeedChannels]);

    return (
        <nav className="channel-list">
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <ul>
                {channels.map(channel => (
                    <li key={channel.channelId} className="channel-item">
                        <Link to={`/${urlLetter}/${feedName}/${channel.channel_name}`}>
                            <div className="channel-link">{channel.channel_name}</div>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    )
};

export default ChannelList;