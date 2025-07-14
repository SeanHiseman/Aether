import ContentDisplay from '../content/contentDisplay';
import ContentThumbnail from '../content/thumbnails/contentThumbnail';
import { Link } from 'react-router-dom';

const ExploreContentWidget = ({ post }) => {
    const urlPrefix = post.parentChannel?.feed?.is_group ? 'g' : 'u';
    
    return (
        <div className="flex flex-col h-full explore-block bg-gray-800 rounded-lg p-4 text-center transition-all duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-xl hover:bg-gray-700">
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
                <div className="flex-1">
                    {/*<ContentThumbnail post={post} />*/}
                    <ContentDisplay content={post.content} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                      <p className="small-text">Views: {post.views}</p>
                      <p className="small-text">Upvotes: {post.upvotes ?? post.votes?.upvotes ?? 0}</p>
                      <p className="small-text">Replies: {post.replies}</p>
                </div>
            </Link>
        </div>
    );
};

export default ExploreContentWidget;