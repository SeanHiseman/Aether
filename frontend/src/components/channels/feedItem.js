import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ChannelList from './channelList';

const FeedItem = ({ feedId, name, photo, linkType }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [feedChannels, setFeedChannels] = useState([]);

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    const updateFeedChannels = useCallback((newChannels) => {
        setFeedChannels(newChannels);
    }, []);

    return (
        <li className={`feed-list-item`}>
            <div className="feed-list-link-container">
                <Link className="feed-list-link" to={`/${linkType}/${name}/Main`}>
                    <img className="small-feed-photo" src={`/${photo}`} alt={'/media/site_images/blank-group-icon.jpg'} />
                    <p className="feed-list-text">{name}</p>
                </Link>
                    <p className="channel-dropdown" onClick={dropdownToggle}>
                    =
                </p>
            </div>
            {dropdownOpen && (
                <ChannelList channels={feedChannels} feedId={feedId} feedName={name} isGroup={linkType === 'g'} setChannels={updateFeedChannels} />
            )}
        </li> 
    )
};

export default FeedItem;