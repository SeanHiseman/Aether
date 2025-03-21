import axios from 'axios';
import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import FeedItem from './feedItem';

const DeepFeedItem = ({ deepFeed, onDropFeed }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchContents = async () => {
        if (contents.length > 0) return; //Prevent refetching if already loaded
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
        if (!isExpanded) {
            fetchContents();
        }
    };

    return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                const droppedFeedId = e.dataTransfer.getData("feedId");
                if (droppedFeedId) {
                    onDropFeed(droppedFeedId, deepFeed.deep_feed_id);
                }
            }}
            onClick={handleExpand}
        >
            <div className="channel-link">
                <p style={{margin: '0'}}>{deepFeed.name}</p>
                {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </div>
            {isExpanded && (
                <div className="feed-list">
                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        contents.map((item) =>
                            item.nestedDeepFeed ? (
                                <DeepFeedItem key={item.nestedDeepFeed.deep_feed_id} deepFeed={item.nestedDeepFeed} onDropFeed={onDropFeed} />
                            ) : (
                                <FeedItem 
                                    feed={item.feed}
                                    isChat={false}
                                />
                            )
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default DeepFeedItem;