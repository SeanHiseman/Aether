import React from 'react';
import ReactDOM from 'react-dom';
import '../css/profile.css';

function SendFriendRequestButton({ receiverProfileId }) {
    const handleSendRequest = () => {
        fetch(`/send_friend_request/${receiverProfileId}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
            });
    };

    return (
        <div>
            <button class="small-button" onClick={handleSendRequest}>Send Friend Request</button>
        </div>
    );
}

const rootElement = document.getElementById('friend-request-root');

//Check if rootElement exists
if (rootElement){
    const receiverProfileId = rootElement.getAttribute('data-receiver-id');
    ReactDOM.render(
        <React.StrictMode>
          <SendFriendRequestButton receiverProfileId={receiverProfileId} />
        </React.StrictMode>,
        rootElement
      );
}

export default SendFriendRequestButton

