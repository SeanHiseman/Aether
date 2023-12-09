import React, { useEffect, useState } from 'react';
import MessagesButton from './messagesButton';
import DirectMessages from './directMessages';

const ChatApp = () => {
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [conversationId, setConversationId] = useState(null);
    useEffect(() => {
        //Empty for now
      }, [selectedFriend, conversationId]);
    return (
        <div>
            <MessagesButton onSelectFriend={(friend, conversation) => {
                selectedFriend(friend);
                setConversationId(conversation);
            }}/>
            {selectedFriend && (
            <DirectMessages 
                friendId={selectedFriend} 
                conversationId={conversationId}
            />
            )}
        </div>
    );
};

export default ChatApp;
