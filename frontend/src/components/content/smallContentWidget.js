import { FaExpand, FaCompress } from 'react-icons/fa';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ContentDisplay from './contentDisplay';
import ContentThumbnail from './thumbnails/contentThumbnail';

const SmallContentWidget = ({ post }) => {
    console.log("post", post);
    const [hasCodeOrApp, setHasCodeOrApp] = useState(false);
    const [isFullscreenMode, setIsFullscreenMode] = useState(false);
    const fullscreenRef = useRef(null);
    const urlPrefix = post.parentChannel?.feed?.is_group ? 'g' : 'u';
    
    const toggleFullscreen = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const element = fullscreenRef.current
        if (!element) return
        const request = element.requestFullscreen
            || element.webkitRequestFullscreen
            || element.mozRequestFullScreen
            || element.msRequestFullscreen
        const exit = document.exitFullscreen
            || document.webkitExitFullscreen
            || document.mozCancelFullScreen
            || document.msExitFullscreen
        document.fullscreenElement ? exit?.call(document) : request?.call(element)
    }

    useEffect(() => {
        const handler = () =>
            setIsFullscreenMode(
                Boolean(
                    document.fullscreenElement
                    || document.webkitFullscreenElement
                    || document.mozFullScreenElement
                    || document.msFullscreenElement
                )
            )
        document.addEventListener('fullscreenchange', handler)
        document.addEventListener('webkitfullscreenchange', handler)
        document.addEventListener('mozfullscreenchange', handler)
        document.addEventListener('MSFullscreenChange', handler)
        return () => {
            document.removeEventListener('fullscreenchange', handler)
            document.removeEventListener('webkitfullscreenchange', handler)
            document.removeEventListener('mozfullscreenchange', handler)
            document.removeEventListener('MSFullscreenChange', handler)
        }
    }, [])

    return (
        <div className="flex flex-col h-full explore-block explore-post bg-gray-800 rounded-lg text-center transition-all duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-xl hover:bg-gray-700">
            <Link to={`/${urlPrefix}/${post.parentChannel?.feed?.feed_name}/${post.parentChannel?.channel_name}/${post.post_id}`}>
                <div className="mb-2">
                    <p className="large-text">{post.title}</p>
                    <p className="small-text">
                        by{" "}
                        <span className="font-semibold">
                          {post.poster?.feed_name || "Unknown"}
                        </span>
                    </p>
                </div>
            </Link>
            <div className="flex-1" ref={fullscreenRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    ...(isFullscreenMode ? { height: '100vh', overflow: 'visible' } : {})
                }}
            >
                <div style={isFullscreenMode ? { flex: 1, overflowY: 'auto' } : { height: '100%' }}>
                    <ContentDisplay content={post.content} onCodeAppChange={setHasCodeOrApp} showFullContent={true} showScrollBar={true} />
                </div>
                <div className="content-footer">
                    {(fullscreenRef.current?.requestFullscreen || fullscreenRef.current?.webkitRequestFullscreen) && hasCodeOrApp && (
                        <button className="large-icon" onClick={toggleFullscreen} title={isFullscreenMode ? "Close full-screen" : "Full-screen"}>
                            {isFullscreenMode ? <FaCompress /> : <FaExpand />}
                        </button>
                    )}
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
                    <p className="small-text">Views: {post.views}</p>
                    <p className="small-text">Upvotes: {post.upvotes ?? post.votes?.upvotes ?? 0}</p>
                    <p className="small-text">Replies: {post.replies}</p>
            </div>
        </div>
    );
};

export default SmallContentWidget;