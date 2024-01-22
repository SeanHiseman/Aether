import React from 'react';
import ContentWidget from './ContentWidget'; 

function ResultsWrapper({ contentItems }) {
    return (
        <div className="results-wrapper">
            <div id="results">
                {contentItems.map(item => (
                    <ContentWidget key={item.post_id} item={item} />
                ))}
            </div>
        </div>
    );
}

export default ResultsWrapper;
