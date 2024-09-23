import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ChannelList from './channelList';

const FeedItem = ({ feedId, name, photo, type, link }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [feedChannels, setFeedChannels] = useState([]);

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    const updateFeedChannels = useCallback((newChannels) => {
        setFeedChannels(newChannels);
    }, []);

    return (
        <li className={`feed-list-item ${type}`}>
            <div className="feed-list-link-container">
                <Link className="feed-list-link" to={link}>
                    <img className="small-feed-photo" src={`/${photo}`} alt={name} />
                    <p className="feed-list-text">{name}</p>
                </Link>
                    <p className="channel-dropdown" onClick={dropdownToggle}>
                    =
                </p>
            </div>
            {dropdownOpen && (
                <ChannelList
                    channels={feedChannels}
                    feedId={feedId}
                    feedName={name}
                    isGroup={type === 'g'}
                    setChannels={updateFeedChannels}
                />
            )}
        </li> 
    )
};

export default FeedItem;