import React from "react";
import PostForm from "../../components/postForm";

function PostChannel({ channelName }) {
    return (
        <div className="post-channel">
            <p class="large-text">{channelName}</p>
            <PostForm />
        </div>
    );
}
export default PostChannel;