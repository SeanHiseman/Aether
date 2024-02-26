import React from "react";
import { Link } from 'react-router-dom';

function ChannelButton({ is_posts, channel_name, name, is_group }) {

    const targetUrl = is_group ? `/group/${name}/${channel_name}` : `/profile/${name}/${channel_name}`
    return (
        <Link to={targetUrl}>
            <button className={is_posts ? "posts-channel-button" : "chat-channel-button"}>
                {channel_name}
            </button>
        </Link>
    );
};

export default ChannelButton;