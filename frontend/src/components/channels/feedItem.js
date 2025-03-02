import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ChannelList from './channelList';

const FeedItem = ({ feedId, isChat, linkType, name, photo, unreadCount }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [feedChannels, setFeedChannels] = useState([]);

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    const updateFeedChannels = useCallback((newChannels) => {
        setFeedChannels(newChannels);
    }, []);

    return (
        <li className="feed-list-item">
            <div className="feed-list-link-container">
                <Link className="feed-list-link" to={isChat ? `/connections/${name}/Main` : `/${linkType}/${name}/Main`}>
                    <img className="small-feed-photo" src={`/${photo}`} alt={'/media/site_images/blank-group-icon.jpg'} />
                    <p className="feed-list-text">{name}</p>
                    {isChat && unreadCount > 0 && (
                        <div className="unread-count">{unreadCount}</div>
                    )}
                </Link>
                <div className="channel-dropdown" onClick={dropdownToggle}>{dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}</div>
            </div>
            {dropdownOpen && (
                <ChannelList channels={feedChannels} feedId={feedId} feedName={name} isChat={isChat} isGroup={linkType === 'g'} setChannels={updateFeedChannels} />
            )}
        </li> 
    )
};

export default FeedItem;