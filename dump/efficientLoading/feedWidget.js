import { Link } from "react-router-dom";
import { useContext, memo } from "react";
import { AuthContext } from "../authContext";
import FollowerChangeButton from "../followerChangeButton";

const FeedWidget = memo(({ feed }) => {
    const { viewer } = useContext(AuthContext);
    
    // Ensure we have feed data
    if (!feed) return null;
    
    const imageUrl = feed.feed_photo
        ? `/${feed.feed_photo}`
        : "/media/site_images/blank-group-icon.jpg";

    return (
        <div className="explore-block bg-gray-800 rounded-lg flex flex-col items-center p-4 h-full">
            <Link 
                to={`/${feed.is_group ? "g" : "u"}/${feed.feed_name}/Main`} 
                className="w-20 h-20 rounded-full overflow-hidden mb-2 flex-shrink-0"
            >
                <img 
                    className="w-full h-full object-cover feed-img" 
                    src={imageUrl} 
                    alt={`${feed.feed_name} profile`}
                    loading="lazy"
                    onError={(e) => {
                        e.target.src = "/media/site_images/blank-group-icon.jpg";
                    }}
                />
            </Link>
            
            <div className="flex flex-col items-center flex-1 min-w-0 w-full">
                {feed.feed_id !== viewer?.feed_id ? (
                    <FollowerChangeButton 
                        feed={feed} 
                        showFollowers={false} 
                        showName={true} 
                        showVertical={false} 
                        viewerId={viewer?.feed_id} 
                    />
                ) : (
                    <p className="text-lg font-bold text-white truncate mt-1 max-w-full px-2">
                        {feed.feed_name}
                    </p>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for better performance
    return prevProps.feed?.feed_id === nextProps.feed?.feed_id &&
           prevProps.feed?.feed_name === nextProps.feed?.feed_name &&
           prevProps.feed?.feed_photo === nextProps.feed?.feed_photo &&
           prevProps.feed?.is_group === nextProps.feed?.is_group;
});

FeedWidget.displayName = 'FeedWidget';

export default FeedWidget;