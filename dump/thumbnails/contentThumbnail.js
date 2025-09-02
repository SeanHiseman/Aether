
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ContentDisplay from '../contentDisplay';
import PropTypes from 'prop-types';

const ContentThumbnail = ({ post: propPost }) => {
    const location = useLocation();
    const fullscreenRef = useRef(null); 
    const post = propPost || location.state?.post;

    if (!post) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="text-white text-xl">Post not found</div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-white overflow-hidden">
            <div 
                ref={fullscreenRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100vh',
                    overflow: 'auto'
                }}
            >
                <ContentDisplay 
                    content={post.content} 
                    showFullContent={true} 
                    showScrollBar={true} 
                />
            </div>
        </div>
    );
};

ContentThumbnail.propTypes = {
    post: PropTypes.object, 
};

export default ContentThumbnail;