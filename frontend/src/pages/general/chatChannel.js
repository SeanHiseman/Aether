import React, { useState } from "react";
import PostForm from "../../components/postForm";

function ChatChannel({ channelName }) {
    const [message, setMessage] = useState('');
    return (
        <div id="channel">
            <div id="channel-header">
                <p class="large-text">{channelName}</p>
            </div>
            <div id="channel-content">
                <p>Content goes here</p>
            </div>
            <div id="channel-input">
                <input className="chat-message-bar" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                <button className="chat-send-button">Send</button>
            </div>
        </div>
    );
}
export default ChatChannel;