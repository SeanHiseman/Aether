import React from "react";
import PostForm from "../../components/postForm";

function PostChannel({ channelName }) {
    return (
        <div id="channel">
            <div id="channel-header">
                <p class="large-text">{channelName}</p>
            </div>
            <div id="channel-content">
                <p>Hello!</p>
            </div>
            <div id="channel-input">
                <PostForm />
            </div>
        </div>
    );
}
export default PostChannel;