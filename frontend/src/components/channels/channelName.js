import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

//Handles displaying and changing the name of chat, profile and group channels
function ChannelName({ channelId, channelName, channelType, locationName, channelUpdate }) {
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChannelName, setIsEditingChannelName] = useState(false);
    const navigate = useNavigate();

    //Updates channel name. Must be between 0 and 30 characters, can't be called 'Main'
    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setErrorMessage("Channel needs a name");
                return;
            //Names over 30 characters already prevented
            } else if (newChannelName === 'Main') {
                setErrorMessage("Channels cannot be named Main");
                return;
            } else {
                const response = await axios.post('/api/change_channel_name', {
                    channelId,
                    channelType,
                    newChannelName,
                });
                if (response.status === 200) {
                    setErrorMessage('');
                    setIsEditingChannelName(false);
                    setNewChannelName('');
                    channelUpdate(channelId, newChannelName); //Updates parent page
                    navigate(`/${channelType}/${locationName}/${newChannelName}`);
                }
            }
        } catch {
            setErrorMessage("Error changing channel name");
        }
    };

    return (
        <div id="channel-name-section">
            {channelName !== 'Main' ? (
                <div id="chat-change">
                    {isEditingChannelName ? (
                        <div id="change-name">
                            <textarea className="change-name-area" value={newChannelName} placeholder="New name" onChange={(e) => {
                                e.preventDefault();
                                const input = e.target.value;
                                const inputLength = input.length;
                                if (inputLength <= 30) {
                                    setNewChannelName(input)
                                } else {
                                    setErrorMessage('Name cannot exceed 30 characters');
                                }
                            }}
                            />
                            <div id="cancel-save">
                                <button className="button" onClick={() => {
                                    setIsEditingChannelName(false);
                                    setNewChannelName('');
                                    setErrorMessage('');
                                }}>Cancel</button>
                                <button className="button" onClick={(e) => {
                                    e.preventDefault();
                                    changeChannelName(e)
                                }}>Save</button>
                            </div>
                        </div>
                    ) : (
                        <div id="chat-name">
                            <p className="text36">{channelName}</p> 
                            <button className="button" onClick={() => {
                                setIsEditingChannelName(true);
                                setNewChannelName(channelName);
                            }}>Change name</button>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text36">Main</p>  
            )}
            <div className="error-message">{errorMessage}</div> 
        </div>
    );

};

export default ChannelName;

