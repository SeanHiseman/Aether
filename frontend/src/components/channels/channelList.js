import axios from 'axios';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import { decrypt } from '../../encryptionUtil';
import FeedItem from './feedItem';
import { UnreadContext } from '../connections/unreadContext';

const ChannelList = ({ channels, feedId, feedName, isChat, isGroup, setChannels }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [subFeeds, setSubFeeds] = useState([]);
    const { state } = useContext(UnreadContext);
    const urlLetter = isGroup ? 'g' : 'u';
    const { viewer } = useContext(AuthContext);

    const getFeedChannels = useCallback(async () => {
        try {
            if (!isChat) {
                const response = await axios.get(`/api/get_feed_channels/${feedId}`);
                setChannels(response.data.channels);
            } else {
                const response = await axios.get(`/api/get_chats/${viewer.feed_id}`, {
                    params: { connectionName: feedName }
                });
                if (response.data.success) {
                    const decryptedChats = response.data.chats.map((chat) => {
                        return {
                            ...chat,
                            title: decrypt(chat.title)
                        };
                    });
                    setChannels(decryptedChats);
                }
            }
        } catch (error) {
            setErrorMessage('Error getting channels');
            setChannels([]);
        }
    }, [feedId, feedName, isChat, setChannels, viewer.feed_id]);

    useEffect(() => {
        getFeedChannels();
    }, [getFeedChannels]);

    return (
        !isChat ? (
            <nav className="channel-list">
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <ul>
                    {channels?.map(channel => (
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
        ) : (
            <nav className="channel-list">
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <ul>
                    {channels?.map(channel => (
                        <li key={channel.chat_id} className="channel-item">
                            <Link to={`/connections/${feedName}/${channel.title}`}>
                                <div className="channel-link">
                                    {channel.title}
                                    {state.chatCounts[channel.chat_id] > 0 && ( 
                                        <span className="unread-count">
                                            {state.chatCounts[channel.chat_id]}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        )
    )
};

export default ChannelList;