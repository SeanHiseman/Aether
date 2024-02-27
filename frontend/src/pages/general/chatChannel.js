import React, { useState } from "react";

function ChatChannel({ channelName }) {
    const [message, setMessage] = useState('');
    return (
        <div className="chat-channel">
            <div className="chat-channel-header">
                <h1>{channelName}</h1>
            </div>
            <div className="chat-channel-input">
                <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."/>
                <button id="message-send-button">Send</button>
            </div>
        </div>
    );
}
export default ChatChannel;