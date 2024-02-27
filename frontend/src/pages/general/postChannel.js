import React from "react";
import PostForm from "../../components/postForm";

function PostChannel({ channelName }) {
    return (
        <div className="post-channel">
            <h1>{channelName}</h1>
            <PostForm />
        </div>
    );
}
export default PostChannel;