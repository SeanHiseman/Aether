import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import ChannelList from './channelList';
import { useSortable } from '@dnd-kit/sortable';

const FeedItem = ({ feed, id, isChat, parentDeepFeedId, unreadCount }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [feedChannels, setFeedChannels] = useState([]);
    const linkType = feed.is_group ? 'g' : 'u';

    const uniqueId = parentDeepFeedId 
        ? `df-${parentDeepFeedId}-feed-${id}` 
        : `sidebar-feed-${id}`;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: uniqueId,  
        data: {
            parentDeepFeedId,
            type: 'feed',
            feed: feed,
            originalId: id  
        }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition,
        zIndex: isDragging ? 1000 : 1,
        position: 'relative',
        opacity: isDragging ? 0.5 : 1,
    } : {};

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    const updateFeedChannels = useCallback((newChannels) => {
        setFeedChannels(newChannels);
    }, []);

    return (
        <li ref={setNodeRef} style={style} className={`feed-list-item ${isDragging ? 'dragging' : ''}`} data-parent-deep-feed-id={parentDeepFeedId}>
            <div className="feed-list-link-container" {...attributes} {...listeners}>
                <Link className="feed-list-link" to={isChat ? `/connections/${feed.feed_name}/Main` : `/${linkType}/${feed.feed_name}/Main`}>
                    <img className="small-feed-photo" src={`/${feed.feed_photo}`} alt={'/media/site_images/blank-group-icon.jpg'} />
                    <p className="text16">{feed.feed_name}</p>
                    {isChat && unreadCount > 0 && (
                        <div className="unread-count">{unreadCount}</div>
                    )}
                </Link>
                <div className="channel-dropdown" onClick={dropdownToggle}>
                    {dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}
                </div>
            </div>
            {dropdownOpen && (
                <ChannelList
                    channels={feedChannels}
                    feedId={feed.feed_id}
                    feedName={feed.feed_name}
                    isChat={isChat}
                    isGroup={feed.is_group}
                    setChannels={updateFeedChannels}
                />
            )}
        </li>
    );
};

export default FeedItem;