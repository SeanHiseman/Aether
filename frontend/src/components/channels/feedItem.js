import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import ChannelList from './channelList';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const FeedItem = ({ dragged, feed, isChat, parentDeepFeedId, unreadCount }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [feedChannels, setFeedChannels] = useState([]);
    const linkType = feed?.is_group ? 'g' : 'u';

    const uniqueId = parentDeepFeedId 
        ? `df-${parentDeepFeedId}-feed-${feed?.feed_id}` 
        : `sidebar-feed-${feed?.feed_id}`;

    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
        id: uniqueId,  
        data: {
            parentDeepFeedId,
            type: 'feed',
            feed: feed,
            originalId: feed?.feed_id  
        }
    });

    const setNodeRef = (element) => {
        setDraggableRef(element);
        setDroppableRef(element);
    };
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: uniqueId, disabled: !!parentDeepFeedId });

    const style = {
        cursor: dragged ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        opacity: isDragging ? 0.8 : 1,
        position: 'relative',
        transform: CSS.Translate.toString(transform),
        transition: 'none',
        zIndex: isDragging ? 1000 : 1,
    };

    const dropdownToggle = () => {
        setDropdownOpen((prevOpen) => !prevOpen);
    };

    const updateFeedChannels = useCallback((newChannels) => {
        setFeedChannels(newChannels);
    }, []);

    return (
        <li ref={setNodeRef} style={style} className={`feed-list-item ${isDragging ? 'dragging' : ''} ${isOver && !parentDeepFeedId ? 'drop-target' : ''}`} data-parent-deep-feed-id={parentDeepFeedId}>
            {(() => {
                const feedContent = (
                    <div className="feed-list-link" {...(dragged ? { ...attributes, ...listeners } : {})}>
                        <img className="small-feed-photo" src={feed?.feed_photo} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} draggable={false} />
                        <p className={`small-text ${feed?.feed_name ? '' : 'faded-text'}`}>
                            {feed?.feed_name || '(Feed not found)'}
                        </p>
                        {isChat && unreadCount > 0 && <div className="unread-count">{unreadCount}</div>}
                    </div>
                );
                const dropdownButton = (
                    <div className="channel-dropdown" onClick={(e) => { e.stopPropagation(); e.preventDefault(); dropdownToggle(); }}>
                        {dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                );
                return (
                    <div className="feed-list-link-container">
                        {!dragged ? (
                            <Link 
                                to={isChat ? `/connections/${feed?.feed_name}/Main` : `/${linkType}/${feed?.feed_name}`} 
                                title={`Go to ${feed?.feed_name}`} 
                                draggable={false}
                            >
                                {feedContent}
                            </Link>
                        ) : (
                            feedContent
                        )}
                        {dropdownButton}
                    </div>
                );
            })()}
            {dropdownOpen && (
                <ChannelList
                    channels={feedChannels}
                    feedId={feed?.feed_id}
                    feedName={feed?.feed_name}
                    isChat={isChat}
                    isGroup={feed?.is_group}
                    setChannels={updateFeedChannels}
                />
            )}
        </li>
    );
};

export default FeedItem;