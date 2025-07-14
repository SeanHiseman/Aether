import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentThumbnail from './contentThumbnail';

const ThumbnailRouter = () => {
    const { post_id } = useParams();
    const [post, setPost] = useState(null);
    
    useEffect(() => {
        const storedPost = sessionStorage.getItem(`post_${post_id}`);
        if (storedPost) {
            setPost(JSON.parse(storedPost));
        }
    }, [post_id]);
    
    if (!post) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="text-white text-xl">Loading post...</div>
            </div>
        );
    }
    return <ContentThumbnail post={post} />;
};

export default ThumbnailRouter;