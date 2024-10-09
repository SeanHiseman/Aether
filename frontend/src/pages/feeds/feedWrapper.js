import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FeedHome from './feedHome';

const GroupWrapper = () => {
    const { feed_name, channel_name } = useParams();
    const navigate = useNavigate();

    //Directs to feed main channel by default
    useEffect(() => {
        if (!channel_name) {
            navigate(`/g/${feed_name}/Main`, { replace: true });
        }
    }, [feed_name, channel_name, navigate]);

    return <FeedHome />;
}

export default GroupWrapper;
