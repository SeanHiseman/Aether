import React, { useCallback, useEffect, useState } from 'react';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import axios from 'axios';
import FeedItem from './FeedItem';

const DeepFeedItem = ({ deepFeed, index }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isExpanded) return;
        if (deepFeed.feeds && contents.length === 0) {
            setContents(deepFeed.feeds);
        }
    }, [deepFeed.feeds, isExpanded, contents.length]);

    const fetchContents = async () => {
        if (contents.length > 0) return;
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/deep_feed_contents/${deepFeed.deep_feed_id}`);
            setContents(data.contents || []);
        } catch (error) {
            setContents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = useCallback((e) => {
        e.stopPropagation();
        if (!isExpanded) {
            fetchContents();
        }
        setIsExpanded(prev => !prev);
    }, [isExpanded]);

    const handleAddFeed = useCallback((feed) => {
        setContents(prevContents => {
            const isAlreadyExists = prevContents.some(
                item => item.feed && item.feed.feed_id === feed.followedFeed.feed_id
            );
            if (isAlreadyExists) return prevContents;
            
            return [...prevContents, {
                feed: {
                    ...feed.followedFeed,
                    feed_id: feed.followedFeed.feed_id,
                    feed_name: feed.followedFeed.feed_name,
                    feed_photo: feed.followedFeed.feed_photo,
                    is_group: feed.link_type === 'g'
                }
            }];
        });
    }, []);

    return (
        <Draggable draggableId={`df-${deepFeed.deep_feed_id}`} index={index}>
            {(provided) => (
                <div ref={provided.innerRef} {...provided.draggableProps} className="deep-feed-container">
                    <div className="channel-link deep-feed-header" {...provided.dragHandleProps}>
                        <Link to={`/p/${deepFeed.name}`}>
                            <p style={{ margin: "0" }}>{deepFeed.name}</p>
                        </Link>
                        <div onClick={handleExpand}>
                            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </div>
                    </div>
                    {isExpanded && (
                        <Droppable droppableId={`deep-feed-${deepFeed.deep_feed_id}`} type="feed">
                            {(provided) => (
                                <div className="feed-list deep-feed-content" ref={provided.innerRef} {...provided.droppableProps}>
                                    {loading ? (
                                        <p>Loading...</p>
                                    ) : (
                                        contents.map((item, itemIndex) =>
                                            item.nestedDeepFeed ? (
                                                <DeepFeedItem key={item.nestedDeepFeed.deep_feed_id} deepFeed={item.nestedDeepFeed} index={itemIndex} />
                                            ) : (
                                                <Draggable key={item.feed.feed_id} draggableId={`df-${item.feed.feed_id}`} index={itemIndex}>
                                                    {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                            <FeedItem feed={item.feed} isChat={false} />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            )
                                        )
                                    )}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    )}
                </div>
            )}
        </Draggable>
    );
};

export default DeepFeedItem;