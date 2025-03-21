import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ChannelList from './channelList';

const FeedItem = ({ feed, isChat, unreadCount }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [feedChannels, setFeedChannels] = useState([]);
    const linkType = feed.is_group ? 'g' : 'u';

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    const updateFeedChannels = useCallback((newChannels) => {
        setFeedChannels(newChannels);
    }, []);

    return (
        <li className="feed-list-item">
            <div className="feed-list-link-container">
                <Link className="feed-list-link" to={isChat ? `/connections/${feed.feed_name}/Main` : `/${linkType}/${feed.feed_name}/Main`}>
                    <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt={'/media/site_images/blank-group-icon.jpg'} />
                    <p className="feed-list-text">{feed.feed_name}</p>
                    {isChat && unreadCount > 0 && (
                        <div className="unread-count">{unreadCount}</div>
                    )}
                </Link>
                <div className="channel-dropdown" onClick={dropdownToggle}>{dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}</div>
            </div>
            {dropdownOpen && (
                <ChannelList channels={feedChannels} feedId={feed.feed_id} feedName={feed.feed_name} isChat={isChat} isGroup={feed.is_group} setChannels={updateFeedChannels} />
            )}
        </li> 
    )
};

export default FeedItem;