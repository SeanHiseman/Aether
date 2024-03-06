import React from "react";

function ProfileFeed({ channelName }) {
    return (
        <div id="channel">
            <div id="channel-header">
                <p class="large-text">{channelName}</p>
            </div>
            <div id="channel-content">
                <p>Posts go here</p>
            </div>
        </div>
    );
}
export default ProfileFeed;