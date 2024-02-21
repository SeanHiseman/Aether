import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Profile from './profile';

function ProfileWrapper() {
    const { username, channel_name } = useParams();
    const navigate = useNavigate();

    //Directs to group main channel by default
    useEffect(() => {
        if (!channel_name) {
            navigate(`/profile/${username}/main`, { replace: true });
        }
    }, [username, channel_name, navigate]);

    return <Profile />;
}

export default ProfileWrapper;
