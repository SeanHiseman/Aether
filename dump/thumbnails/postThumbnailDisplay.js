import { useState } from 'react';
import PropTypes from 'prop-types';

const PostThumbnailDisplay = ({ post }) => {
    const [imageError, setImageError] = useState(false);
    
    // URL to the full-screen ContentThumbnail page
    const thumbnailPageUrl = `/thumbnail/${post.post_id}`;
    
    return (
        <div className="relative group cursor-pointer">
            <div className="aspect-video bg-gray-700 rounded-lg overflow-hidden">
                {!imageError ? (
                    <img
                        src={thumbnailPageUrl}
                        alt={`Screenshot of ${post.title}`}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-700">
                        <div className="text-center text-gray-400">
                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm">No preview</span>
                        </div>
                    </div>
                )}
            </div>
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg">
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-b-lg">
                    <p className="text-white text-sm font-medium truncate">
                        {post.title}
                    </p>
                    <p className="text-gray-300 text-xs truncate">
                        by {post.poster?.feed_name || "Unknown"}
                    </p>
                </div>
            </div>
        </div>
    );
};

PostThumbnailDisplay.propTypes = {
    post: PropTypes.object.isRequired,
};

export default PostThumbnailDisplay;