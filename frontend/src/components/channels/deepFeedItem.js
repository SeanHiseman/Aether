import React, { useCallback, useContext, useEffect, useState } from 'react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragOverlay } from '@dnd-kit/core';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../authContext';
import FeedItem from './FeedItem';

const DeepFeedItem = ({ index, deepFeed, onFeedAdded, showHeader }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [dragType, setDragType] = useState(null);
    const [error, setError] = useState('');
    const { viewer } = useContext(AuthContext);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const {
        attributes,
        listeners,
        setNodeRef,
    } = useSortable({
        id: `df-${deepFeed.deep_feed_id}`,
    });

    useEffect(() => {
        if (!showHeader) {
            setIsExpanded(true);
        }
    }, [showHeader]);

    useEffect(() => {
        if (!isExpanded) return;
        if (deepFeed.feeds && contents.length === 0) {
            setContents(deepFeed.feeds);
        }
    }, [deepFeed.feeds, isExpanded, contents.length]);

    useEffect(() => {
        if (onFeedAdded) {
            onFeedAdded(deepFeed.deep_feed_id, handleAddFeed);
        }
        return () => {
            if (onFeedAdded) {
                onFeedAdded(deepFeed.deep_feed_id, null);
            }
        };
    }, [deepFeed.deep_feed_id, onFeedAdded]);

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
        if (!showHeader) return;
        if (!isExpanded) {
            fetchContents();
        }
        setIsExpanded(prev => !prev);
    }, [isExpanded, showHeader]);

    const handleAddFeed = useCallback((feed) => {
        if (feed.type === 'UPDATE_CONTENTS') {
            fetchContents();
            return;
        }
        
        if (feed.type === 'ADD_NESTED_DEEP_FEED') {
            setContents(prevContents => [...prevContents, { nestedDeepFeed: feed.nestedDeepFeed }]);
            return;
        }
        
        setContents(prevContents => {
            //Check if this feed already exists in the content
            const isAlreadyExists = prevContents.some(
                item => item.feed && item.feed.feed_id === feed.feed_id
            );
            if (isAlreadyExists) return prevContents;
            return [...prevContents, {
                feed: {
                    feed_id: feed.feed_id,
                    feed_name: feed.followedFeed.feed_name,
                    feed_photo: feed.followedFeed.feed_photo,
                    is_group: feed.link_type === 'g'
                }
            }];
        });
    }, []);

    const handleDragStart = (event) => {
        const { active } = event;
        const activeId = active.id;
        let dragType = 'feed';
        let dragItem = null;
        if (typeof activeId === 'string' && activeId.startsWith('df-item-')) {
            dragType = 'feedInDeepFeed';
            const feedId = activeId.replace('df-item-', '');
            const content = contents.find(item => 
                item.feed && item.feed.feed_id === feedId
            );
            if (content) {
                dragItem = {
                    feed: content.feed,
                    parentDeepFeedId: deepFeed.deep_feed_id
                };
            }
        } else if (typeof activeId === 'string' && activeId.startsWith('nested-df-')) {
            dragType = 'nestedDeepFeed';
            const nestedDeepFeedId = activeId.replace('nested-df-', '');
            const content = contents.find(item => 
                item.nestedDeepFeed && item.nestedDeepFeed.deep_feed_id === nestedDeepFeedId
            );
            if (content) {
                dragItem = {
                    nestedDeepFeed: content.nestedDeepFeed,
                    parentDeepFeedId: deepFeed.deep_feed_id
                };
            }
        }
        setDragType(dragType);
        setActiveDragItem(dragItem);
        setActiveId(activeId);
    };
    
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over) {
            if (dragType === 'feedInDeepFeed') {
                try {
                    const sourceFeedId = activeId.replace('df-item-', '');
                    const { data } = await axios.post("/api/remove_from_deep_feed", {
                        deepFeedId: deepFeed.deep_feed_id,
                        feedId: sourceFeedId
                    });
                    if (data.success) {
                        setContents(prevContents => 
                            prevContents.filter(item => 
                                !(item.feed && item.feed.feed_id === sourceFeedId)
                            )
                        );
                    }
                } catch (error) {
                    setError("Error removing feed from deep feed");
                    setTimeout(() => setError(''), 3000);
                }
            } else if (dragType === 'nestedDeepFeed') {
                try {
                    const nestedDeepFeedId = activeId.replace('nested-df-', '');
                    const { data } = await axios.post("/api/remove_from_deep_feed", {
                        deepFeedId: deepFeed.deep_feed_id,
                        nestedDeepFeedId: nestedDeepFeedId
                    });
                    if (data.success) {
                        setContents(prevContents => 
                            prevContents.filter(item => 
                                !(item.nestedDeepFeed && item.nestedDeepFeed.deep_feed_id === nestedDeepFeedId)
                            )
                        );
                    }
                } catch (error) {
                    setError("Error removing nested deep feed");
                    setTimeout(() => setError(''), 3000);
                }
            }
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        const activeId = active.id;
        const overId = over.id;
        //Skip if same position
        if (activeId === overId) {
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        try {
            //Combining feeds within this deep feed to create a nested deep feed
            if (dragType === 'feedInDeepFeed' && typeof overId === 'string' && overId.startsWith('df-item-')) {
                const sourceFeedId = activeId.replace('df-item-', '');
                const destFeedId = overId.replace('df-item-', '');
                const sourceFeedItem = contents.find(item => 
                    item.feed && item.feed.feed_id === sourceFeedId
                )?.feed;
                const destFeedItem = contents.find(item => 
                    item.feed && item.feed.feed_id === destFeedId
                )?.feed;
                if (sourceFeedItem && destFeedItem) {
                    const deepFeedName = prompt("Create a new nested deep feed by combining these feeds. Enter a name:");
                    if (deepFeedName) {
                        try {
                            const { data } = await axios.post("/api/create_deep_feed", {
                                viewerId: viewer.feed_id,
                                deepFeedName,
                                feedsToInclude: [sourceFeedId, destFeedId],
                                parentDeepFeedId: deepFeed.deep_feed_id
                            });
                            if (data.success && data.deepFeed) {
                                //Update the contents to remove the two combined feeds and add the new nested deep feed
                                setContents(prevContents => {
                                    const filteredContents = prevContents.filter(item => 
                                        !(item.feed && (item.feed.feed_id === sourceFeedId || item.feed.feed_id === destFeedId))
                                    );
                                    return [
                                        ...filteredContents, 
                                        { nestedDeepFeed: data.deepFeed }
                                    ];
                                });
                            }
                        } catch (error) {
                            setError("Error creating nested deep feed");
                            setTimeout(() => setError(''), 3000);
                        }
                    }
                }
            }
        } catch (error) {
            setError("Error in drag operation");
            setTimeout(() => setError(''), 3000);
        }
        
        setActiveId(null);
        setActiveDragItem(null);
        setDragType(null);
    };

    const sortableItemIds = [
        ...contents
            .filter(item => item.feed)
            .map(item => `df-item-${item.feed.feed_id}`),
        ...contents
            .filter(item => item.nestedDeepFeed)
            .map(item => `nested-df-${item.nestedDeepFeed.deep_feed_id}`)
    ];

    return (
        <div ref={setNodeRef} className="deep-feed-container">
            {showHeader && (
                <div className="channel-link deep-feed-header" {...attributes} {...listeners}>
                    <Link to={`/d/${deepFeed.deep_feed_id}`}>
                        <p style={{ margin: "0" }}>{deepFeed.name}</p>
                    </Link>
                    <div onClick={handleExpand}>
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                    {error && <div className="error-message">{error}</div>}
                </div>
            )}
            {isExpanded && (
                <div className="feed-list deep-feed-content">
                    {loading ? (
                        <p className="text16">Loading...</p>
                    ) : (
                        <>
                            {error && <div className="error-message">{error}</div>}
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                                <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
                                    {contents.map((item, itemIndex) =>
                                        item.nestedDeepFeed ? (
                                            <DeepFeedItem 
                                                key={item.nestedDeepFeed.deep_feed_id} 
                                                deepFeed={item.nestedDeepFeed} 
                                                index={itemIndex}
                                                onFeedAdded={onFeedAdded}
                                                showHeader={true}
                                                id={`nested-df-${item.nestedDeepFeed.deep_feed_id}`}
                                            />
                                        ) : (
                                            <FeedItem key={item.feed.feed_id} id={`df-item-${item.feed.feed_id}`} feed={item.feed} isChat={false} />
                                        )
                                    )}
                                </SortableContext>
                                <DragOverlay>
                                    {activeId && activeDragItem && dragType === 'feedInDeepFeed' && (
                                        <div className="feed-list-item feed-drag-overlay">
                                            <div className="feed-list-link-container">
                                                <div className="feed-list-link">
                                                    <img className="small-feed-photo" src={`/${activeDragItem.feed.feed_photo}`} alt="Feed" />
                                                    <p className="feed-list-text">{activeDragItem.feed.feed_name}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {activeId && activeDragItem && dragType === 'nestedDeepFeed' && (
                                        <div className="deep-feed-container deep-feed-drag-overlay">
                                            <div className="channel-link deep-feed-header">
                                                <p style={{ margin: "0" }}>{activeDragItem.nestedDeepFeed.name}</p>
                                            </div>
                                        </div>
                                    )}
                                </DragOverlay>
                            </DndContext>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeepFeedItem;