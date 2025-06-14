import { useCallback, useEffect, useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import axios from 'axios';
import FeedItem from './FeedItem';

const DeepFeedItem = ({ deepFeed, onFeedAdded, parentDeepFeedId = null, showHeader }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const { attributes, listeners, setNodeRef } = useSortable({
        id: parentDeepFeedId ? `nested-df-${deepFeed.deep_feed_id}` : `df-${deepFeed.deep_feed_id}`,
        data: {
            parentDeepFeedId: parentDeepFeedId,
            type: parentDeepFeedId ? 'nestedDeepFeed' : 'deepFeed',
            nestedDeepFeed: deepFeed
        }
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
        try {
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
        } catch (error) {
            setErrorMessage('Error fetching contents. Please try again.');
            setTimeout(() => { setErrorMessage(''); }, 5000);
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
        try {
            //console.log('Adding feed:', feed);
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
                        feed_name: feed.feed_name,
                        feed_photo: feed.feed_photo,
                        is_group: feed.is_group,
                    }
                }];
            });
        } catch (error) {
            setErrorMessage('Error adding feed. Please try again.');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }, []);

    const sortableItemIds = [
        ...contents
            .filter(item => item.feed)
            .map(item => `df-item-${item.feed.feed_id}`),
        ...contents
            .filter(item => item.nestedDeepFeed)
            .map(item => `nested-df-${item.nestedDeepFeed.deep_feed_id}`)
    ];

    return (
        <div ref={setNodeRef} className="deep-feed-container" data-deep-feed-id={deepFeed.deep_feed_id}>
            {showHeader && (
                <div className="channel-link deep-feed-header" {...attributes} {...listeners}>
                    <Link to={`/d/${deepFeed.deep_feed_id}`}>
                        <p style={{ margin: "0" }}>{deepFeed.name}</p>
                    </Link>
                    <div onClick={handleExpand}>
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                </div>
            )}
            {isExpanded && (
                <div className="feed-list deep-feed-content">
                    {loading ? (
                        <p className="text16">Loading...</p>
                    ) : (
                        <>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                            <SortableContext id={`sortable-${deepFeed.deep_feed_id}`} items={sortableItemIds} strategy={verticalListSortingStrategy}>
                                {contents.map((item) =>
                                    item.nestedDeepFeed ? (
                                        <DeepFeedItem 
                                            key={item.nestedDeepFeed.deep_feed_id}
                                            deepFeed={item.nestedDeepFeed}
                                            onFeedAdded={onFeedAdded}
                                            parentDeepFeedId={deepFeed.deep_feed_id}
                                            showHeader={true}
                                        />
                                    ) : (
                                        <FeedItem 
                                            key={item.feed.feed_id}
                                            id={`df-item-${item.feed.feed_id}`}
                                            feed={item.feed}
                                            isChat={false}
                                            parentDeepFeedId={deepFeed.deep_feed_id}
                                        />
                                    )
                                )}
                            </SortableContext>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeepFeedItem;