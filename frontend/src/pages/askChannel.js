import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { v4 } from 'uuid';

function AskChannel() {
    const [channel, setChannel] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const sendAskMessage = () => {
        console.log("Ask message test.");
    };

    return (
        <div className="search-container">  
            <div className="content-feed">
                <div className="channel-feed">
                    <div id="channel">
                        <div className="channel-content messages">
                            <p>Hello!</p>
                        </div>
                        <div id="channel-input">
                            <input class="chat-message-bar" type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Ask..." onKeyDown={(e) => e.key === 'Enter' && sendAskMessage()}/>
                            <button class="chat-send-button" onClick={sendAskMessage()}>Send</button>
                            {errorMessage && <div class="error-message">{errorMessage}</div>}
                        </div>
                    </div>
                </div>
            </div>
            <aside id="right-aside">
                <p>Test</p>
            </aside>
        </div>
    );
}
export default AskChannel;