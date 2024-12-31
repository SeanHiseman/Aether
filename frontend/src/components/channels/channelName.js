import axios from 'axios';
import { FaTrash, FaEdit } from 'react-icons/fa';
import React, { useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { useNavigate } from 'react-router-dom';

const ChannelName = ({ channelId, channelName, channelUpdate, deleteChannel, isGroup, locationName }) => {
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingChannelName, setIsEditingChannelName] = useState(false);
    const navigate = useNavigate();

    //Updates channel name. Must be between 0 and 30 characters, can't be called 'Main'
    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setErrorMessage("Feed needs a name");
                return;
            //Names over 30 characters already prevented
            } else if (newChannelName === 'Main') {
                setErrorMessage("Feeds cannot be named Main");
                return;
            } else {
                const response = await axios.post('/api/change_channel_name', {
                    channelId,
                    newChannelName,
                });
                if (response.status === 200) {
                    const urlLetter = isGroup ? 'g' : 'u';
                    setErrorMessage('');
                    setIsEditingChannelName(false);
                    setNewChannelName('');
                    channelUpdate(channelId, newChannelName); //Updates parent page
                    navigate(`/${urlLetter}/${locationName}/${newChannelName}`);
                }
            }
        } catch {
            setErrorMessage("Error changing feed name");
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${channelName}?`)) {
            try {
                await axios.delete(`/api/delete_feed_channel`, { data: { channelId } });
                deleteChannel(channelId); 
                navigate(`/${isGroup ? 'g' : 'u'}/${locationName}/Main`);
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
                                    <p className="icon-text">Rename</p>
                                </button>
                                <button className="small-icon" onClick={handleDelete}>
                                    <FaTrash />
                                    <p className="icon-text">Delete</p>
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

