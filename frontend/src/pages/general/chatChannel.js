import React, { useState } from "react";

function ChatChannel({ channelName }) {
    const [message, setMessage] = useState('');
    return (
        <div id="chat-channel">
            <div id="chat-channel-header">
                <p class="large-text">{channelName}</p>
            </div>
            <div id="chat-channel-feed">
                <p>Hello!</p>
            </div>
            <div id="chat-channel-input">
                <input className="chat-message-bar" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                <button className="chat-send-button">Send</button>
            </div>
        </div>
    );
}
export default ChatChannel;