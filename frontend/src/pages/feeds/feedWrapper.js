import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import FeedHome from './feedHome';

const FeedWrapper = () => {
    const { feed_name, channel_name } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isGroupFeed = location.pathname.startsWith('/g/');

    const defaultPath = isGroupFeed 
        ? `/g/${feed_name}/Main`
        : `/u/${feed_name}/Main`;

    //Directs to feed main channel by default
    useEffect(() => {
        if (!channel_name) {
            navigate(defaultPath, { replace: true });
        }
    }, [feed_name, channel_name, navigate]);

    return <FeedHome />;
}

export default FeedWrapper;
