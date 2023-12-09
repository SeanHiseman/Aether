import React from 'react';
import ReactDOM from 'react-dom';
import SendFriendRequestButton from './components/sendFriendRequest';
import FriendRequests from './components/friendRequestsList';
import UpdateBioButton from './components/updateBio';
import ChatApp from './components/chatApp';
import { UserProvider } from './components/userContext';

//Below functions check if a root exists so it can be rendered on the corresponding page

const friendRequestRoot = document.getElementById('friend-request-root');
if (friendRequestRoot) {
    const receiverProfileId = friendRequestRoot.getAttribute('data-receiver-id');
    ReactDOM.render(
        <SendFriendRequestButton receiverProfileId={receiverProfileId} />, 
        friendRequestRoot
    );
}

const incomingRequestsRoot = document.getElementById('incoming-requests-root');
if (incomingRequestsRoot) {
    ReactDOM.render(
        <FriendRequests />,
        incomingRequestsRoot
    );
}

const updateBio = document.getElementById('update-bio');
if (updateBio) {
    ReactDOM.render(
        <UpdateBioButton />,
        updateBio
    );
}

const chatAppRoot = document.getElementById('chat-app-root');
if (chatAppRoot){
    ReactDOM.render(
        <UserProvider>
            <ChatApp />
        </UserProvider>,
        chatAppRoot
    );
}
