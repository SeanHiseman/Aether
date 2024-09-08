import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GroupHome from './groupHome';

const GroupWrapper = () => {
    const { group_name, channel_name } = useParams();
    const navigate = useNavigate();

    //Directs to group main channel by default
    useEffect(() => {
        if (!channel_name) {
            navigate(`/g/${group_name}/Main`, { replace: true });
        }
    }, [group_name, channel_name, navigate]);

    return <GroupHome />;
}

export default GroupWrapper;
