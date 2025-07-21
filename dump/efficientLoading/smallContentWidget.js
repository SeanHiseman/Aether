import { FaExpand, FaCompress } from 'react-icons/fa';
import { useEffect, useRef, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import ContentDisplay from './contentDisplay';
import ContentThumbnail from './thumbnails/contentThumbnail';

const SmallContentWidget = memo(({ post }) => {
    console.log('SmallContentWidget render - post:', post);
    const [hasCodeOrApp, setHasCodeOrApp] = useState(false);
    const [isFullscreenMode, setIsFullscreenMode] = useState(false);
    const fullscreenRef = useRef(null);

    const toggleFullscreen = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const element = fullscreenRef.current;
        if (!element) return;
        
        const request = element.requestFullscreen
            || element.webkitRequestFullscreen
            || element.mozRequestFullScreen
            || element.msRequestFullscreen;
        const exit = document.exitFullscreen
            || document.webkitExitFullscreen
            || document.mozCancelFullScreen
            || document.msExitFullscreen;
            
        document.fullscreenElement ? exit?.call(document) : request?.call(element);
    };

    useEffect(() => {
        const handler = () =>
            setIsFullscreenMode(
                Boolean(
                    document.fullscreenElement
                    || document.webkitFullscreenElement
                    || document.mozFullScreenElement
                    || document.msFullscreenElement
                )
            );
            
        const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        events.forEach(event => document.addEventListener(event, handler));
        
        return () => {
            events.forEach(event => document.removeEventListener(event, handler));
        };
    }, []);

    if (!post) return null;
    
    const urlPrefix = post.parentChannel?.feed?.is_group ? 'g' : 'u';
    if (!post) {
        console.log('SmallContentWidget: No post data, returning null');
        return null;
    }
    return (
        <div className="flex flex-col h-full explore-block explore-post bg-gray-800 rounded-lg text-center transition-all duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-xl hover:bg-gray-700 p-4">
            <Link 
                to={`/${urlPrefix}/${post.parentChannel?.feed?.feed_name}/${post.parentChannel?.channel_name}/${post.post_id}`}
                className="block mb-2"
            >
                <p className="large-text text-white font-semibold line-clamp-2">
                    {post.title || "Untitled"}
                </p>
                <p className="small-text text-gray-400">
                    by{" "}
                    <span className="font-semibold text-gray-300">
                        {post.poster?.feed_name || "Unknown"}
                    </span>
                </p>
            </Link>
            
            <div 
                className="flex-1 relative min-h-0" 
                ref={fullscreenRef}
                style={{
                    ...(isFullscreenMode ? { 
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        padding: '2rem'
                    } : {})
                }}
            >
                <div className={isFullscreenMode ? "h-full overflow-y-auto" : "h-48 overflow-hidden"}>
                    <ContentDisplay 
                        content={post.content} 
                        onCodeAppChange={setHasCodeOrApp} 
                        showFullContent={!isFullscreenMode} 
                        showScrollBar={isFullscreenMode} 
                    />
                </div>
                
                {hasCodeOrApp && (
                    <div className="content-footer absolute bottom-2 right-2">
                        <button 
                            className="large-icon bg-gray-700 hover:bg-gray-600 p-2 rounded-full transition-colors" 
                            onClick={toggleFullscreen} 
                            title={isFullscreenMode ? "Close full-screen" : "Full-screen"}
                        >
                            {isFullscreenMode ? <FaCompress /> : <FaExpand />}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-4 flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
                <span>Views: {post.views || 0}</span>
                <span>Upvotes: {post.upvotes ?? post.votes?.upvotes ?? 0}</span>
                <span>Replies: {post.replies || 0}</span>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for better performance
    return prevProps.post?.post_id === nextProps.post?.post_id &&
           prevProps.post?.views === nextProps.post?.views &&
           prevProps.post?.upvotes === nextProps.post?.upvotes &&
           prevProps.post?.replies === nextProps.post?.replies;
});

SmallContentWidget.displayName = 'SmallContentWidget';

export default SmallContentWidget;