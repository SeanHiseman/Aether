import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GroupHome from './groupHome';

function GroupWrapper() {
    const { group_name, channel_name } = useParams();
    const navigate = useNavigate();

    //Directs to group main channel by default
    useEffect(() => {
        if (!channel_name) {
            navigate(`/group/${group_name}/main`, { replace: true });
        }
    }, [group_name, channel_name, navigate]);

    return <GroupHome />;
}

export default GroupWrapper;
