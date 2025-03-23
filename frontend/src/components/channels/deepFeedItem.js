import axios from 'axios';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import FeedItem from './feedItem';

const DeepFeedItem = ({ deepFeed }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchContents = async () => {
        if (contents.length > 0) return;
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/deep_feed_contents/${deepFeed.deep_feed_id}`);
            setContents(data.contents);
        } catch (error) {
            console.error("Error fetching deep feed contents:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = () => {
        setIsExpanded(!isExpanded);
        if (!isExpanded) fetchContents();
    };

    return (
        <Droppable droppableId={`deepFeed-${deepFeed.deep_feed_id}`} isDropDisabled={!isExpanded}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="deep-feed-container"
                    onClick={handleExpand}
                >
                    <div className="channel-link">
                        <p>{deepFeed.name}</p>
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                    {isExpanded && (
                        <div className="feed-list">
                            {loading ? <p>Loading...</p> : (
                                contents.map((item, index) => (
                                    <Draggable
                                        key={item.feed?.feed_id || item.nestedDeepFeed?.deep_feed_id}
                                        draggableId={item.feed ? `feed-${item.feed.feed_id}` : `deep-${item.nestedDeepFeed.deep_feed_id}`}
                                        index={index}
                                    >
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                {item.nestedDeepFeed ? (
                                                    <DeepFeedItem deepFeed={item.nestedDeepFeed} />
                                                ) : (
                                                    <FeedItem feed={item.feed} isChat={false} />
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))
                            )}
                            {provided.placeholder}
                        </div>
                    )}
                </div>
            )}
        </Droppable>
    );
};

export default DeepFeedItem;