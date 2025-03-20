import { useState, useEffect } from 'react';
import axios from 'axios';

const DeepFeedItem = ({ deepFeed }) => {
    console.log("DeepFeedItem", deepFeed);
    const [contents, setContents] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (isExpanded) {
            axios.get(`/api/deep_feed_contents/${deepFeed.deep_feed_id}`)
                .then(({ data }) => setContents(data.contents))
                .catch(error => console.error("Error loading deep feed contents:", error));
        }
    }, [isExpanded]);

    return (
        <li>
            <button onClick={() => setIsExpanded(!isExpanded)}>{isExpanded ? "▼" : "▶"} {deepFeed.name}</button>
            {isExpanded && <ul>{contents.map(content => <li key={content.content_id}>{content.feed_id || content.nested_deep_feed_id}</li>)}</ul>}
        </li>
    );
};

export default DeepFeedItem;