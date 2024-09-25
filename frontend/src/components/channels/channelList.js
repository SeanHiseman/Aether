import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FeedItem from './feedItem';

const ChannelList = ({ channels, feedId, feedName, isGroup, setChannels }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [subFeeds, setSubFeeds] = useState([]);
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

    //Fetch subfeedss
    useEffect(() => {
        if (isGroup) {
            const fetchSubFeeds = async () => {
                try {
                    const response = await axios.get(`/api/sub_feeds/${feedId}`);
                    setSubFeeds(response.data);
                } catch (error) {
                    setErrorMessage("Error getting subfeeds");
                }
            };
            if (feedId) {
                fetchSubFeeds();
            }
        }
    }, [feedId]);

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
            <ul>
                {subFeeds.length > 0 && (
                    subFeeds.map((subFeed) => (
                        <FeedItem key={subFeed.feed_id} feedId={subFeed.feed_id} name={subFeed.name} photo={subFeed.photo} type="g" link={`/g/${subFeed.name}/Main`} />
                    ))
                )}
            </ul>
        </nav>
    )
};

export default ChannelList;