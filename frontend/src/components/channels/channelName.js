import axios from 'axios';
import { FaTrash, FaEdit } from 'react-icons/fa';
import React, { useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { useNavigate } from 'react-router-dom';
import { encrypt } from '../../encryptionUtil';

const ChannelName = ({ channelId, channelName, channelUpdate, deleteChannel, isChat, isGroup, locationName }) => {
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChannelName, setIsEditingChannelName] = useState(false);
    const urlPrefix = isChat ? 'connections' : isGroup ? 'g' : 'u';
    const navigate = useNavigate();

    //Updates channel name. Must be between 0 and 30 characters, can't be called 'Main'
    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setErrorMessage("Channel needs a name");
                return;
            //Names over 30 characters already prevented
            }
            if (newChannelName === 'Main') {
                setErrorMessage("Channel cannot be named Main");
                return;
            } 
            let finalChannelName = newChannelName;
            if (isChat) {
                const encryptedChannelName = encrypt(newChannelName);
                finalChannelName = encryptedChannelName;
            }
            const route = isChat ? '/api/change_chat_name' : '/api/change_channel_name';
            const response = await axios.post(route, {
                channelId,
                newChannelName: finalChannelName,
            });
            if (response.status === 200) {
                setErrorMessage('');
                setIsEditingChannelName(false);
                setNewChannelName('');
                channelUpdate(channelId, newChannelName); //Updates parent page
                navigate(`/${urlPrefix}/${locationName}/${newChannelName}`);
            }
        } catch {
            setErrorMessage("Error changing channel name");
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${channelName}?`)) {
            try {
                if (channelName === 'Main') {
                    setErrorMessage("Main chat cannot be deleted.");
                    return;
                }
                const route = isChat ? '/api/delete_chat' : '/api/delete_feed_channel';
                const response = await axios.delete(route, { data: { channelId } });
                if (response.data.success) {
                    deleteChannel(channelId); 
                    navigate(`/${urlPrefix}/${locationName}/Main`);
                }
            } catch (error) {
                setErrorMessage('Error deleting channel');
            }
        }
    };

    return (
        <div id="channel-name-section">
            {channelName !== 'Main' ? (
                <div className="chat-change">
                    {isEditingChannelName ? (
                        <div className="change-name">
                            <textarea className="change-name-area" value={newChannelName} placeholder="New name" onChange={(e) => {
                                e.preventDefault();
                                const input = e.target.value;
                                const inputLength = input.length;
                                if (inputLength <= 30) {
                                    setNewChannelName(input)
                                } else {
                                    setErrorMessage('Name too long');
                                }
                            }}
                            />
                            <div className="cancel-save">
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
                        <div className="chat-name">
                            <p className="text36">{channelName}</p> 
                            <div className="button-group">
                                <button className="small-icon" onClick={() => {
                                    setIsEditingChannelName(true);
                                    setNewChannelName(channelName);
                                }}>
                                    <FaEdit />
                                </button>
                                <button className="small-icon" onClick={handleDelete}>
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text36">Main</p>  
            )}
            {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
    );

};

export default ChannelName;

