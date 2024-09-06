import axios from 'axios';
import React, { useEffect, useState } from 'react';

function GroupProfileView({ group, setGroup }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [groupPhotoFile, setGroupPhotoFile] = useState('No file chosen');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [newDescription, setDescription] = useState('');
    const [newName, setName] = useState('');

    //Set name in text area to current description
    useEffect(() => {
        if (isEditingName) {
            setName(group.groupName);
        }
    }, [isEditingName, group.groupName]);

    //Set description in text area to current description
    useEffect(() => {
        if (isEditingDescription) {
            setDescription(group.description);
        }
    }, [isEditingDescription, group.description]);

    const ChangeGroupPhoto = async (event) => {
        try {
            event.preventDefault();
            const fileInput = event.target.elements.new_group_photo;
            if (!fileInput.files[0]) {
                setErrorMessage('Please upload an image');
                return;
            }
            const formData = new FormData();
            formData.append('new_group_profile_photo', fileInput.files[0]);
            const response = await axios.put(`/api/update_group_photo/${group.groupId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },    
            })
            setGroup(prevDetails => ({
                ...prevDetails,
                groupPhoto: response.data.newPhotoPath
            }))
            setIsPhotoFormVisible(false);
            setErrorMessage('');
        } catch(error) {
            if (error.response.status === 413) {
                setErrorMessage("File cannot be more than 5MB");
            } else if (error.response.status === 400) {
                setErrorMessage(error.response.data.error || "Error, please try again");
            } else {
                setErrorMessage("Error, please try again");
            }
        };
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setGroupPhotoFile(file.name);
            setIsFileSelected(true);
        } else {
            setGroupPhotoFile('No file chosen');
            setIsFileSelected(false);
        }
    };

    //Changes group description
    const handleUpdateDescription = async () => {
        try {
            await axios.post('/api/change_description', {
                description: newDescription,
                groupId: group.groupId
            });
            setGroup({ ...group, description: newDescription });
            setIsEditingDescription(false);
        }
        catch (error) {
            setErrorMessage('Error changing description');
        }
    }; 

    //Changes group name
    const handleUpdateName = async () => {
        try {
            await axios.post('/api/change_group_name', {
                groupName: newName,
                groupId: group.groupId
            });
            setGroup({ ...group, groupName: newName });
            setIsEditingName(false);
        }
        catch (error) {
            setErrorMessage('Error changing name');
        }
    }; 
    
    const togglePhotoForm = () => {
        if (isPhotoFormVisible) {
            setErrorMessage('');
            setGroupPhotoFile('No file selected');
            setIsFileSelected(false);
        }
        setIsPhotoFormVisible(!isPhotoFormVisible);
    };

    //Changes group between public and private
    const togglePrivate = async () => {
        try {
            const response = await axios.post('/api/toggle_private', { locationId: group.groupId, isGroup: true });
            setGroup(prevDetails => ({
                ...prevDetails, 
                isPrivate: response.data.is_private
            }));
        } catch (error) {
            setErrorMessage('Error changing status');
        }
    };

    return (
        <div className="profile-settings">  
            <div className="name-photo-area">
                <div className="profile-header-photo">
                    <img className="settings-profile-photo" src={`/${group.groupPhoto}`} alt={group.groupName} />
                    <button className="button" onClick={togglePhotoForm}>
                        {isPhotoFormVisible ? 'Close' : 'Change feed photo'}
                    </button>
                    {isPhotoFormVisible && (
                        <form className="change-profile-photo" onSubmit={ChangeGroupPhoto}>
                            <div className="file-input">
                                <label htmlFor="new-group-photo" class="dark-button">Change feed photo</label>
                                <input type="file" id="new-group-photo" name="new_group_photo" accept="image/*" onChange={handleFileChange} hidden/>
                                <span className="file-name">{groupPhotoFile}</span> 
                            </div>
                            <input className={isFileSelected ? 'dark-button' : 'dark-button-disabled'} type="submit" value="Update" disabled={!isFileSelected}/>
                        </form>
                    )}
                </div>
                <div className="viewed-profile-info">
                    <div className="chat-change">
                        {isEditingName ? (
                            <div className="change-name">
                                <textarea className="change-name-area long" value={newName} placeholder="Group name..." onChange={(e) => {
                                    e.preventDefault();
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 30) {
                                        setName(input)
                                    } else {
                                        setErrorMessage('Name too long');
                                    }
                                }}
                                />
                                <div className="cancel-save">
                                    <button className="button" onClick={() => {
                                        setIsEditingName(false);
                                        setName('');
                                        setErrorMessage('');
                                    }}>Cancel</button>
                                    <button className="button" onClick={(e) => {
                                        e.preventDefault();
                                        handleUpdateName()
                                    }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="chat-name">
                                <p className="text36">{group.groupName}</p> 
                                <button className="button" onClick={() => {
                                    setIsEditingName(true);
                                    setName(group.groupName);
                                }}>Change username</button>
                            </div>
                        )}
                    </div>
                    <div className="chat-change">
                        {isEditingDescription ? (
                            <div className="change-name">
                                <textarea className="change-text-area" value={newDescription} placeholder="Description..." onChange={(e) => {
                                    e.preventDefault();
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 1000) {
                                        setDescription(input)
                                    } else {
                                        setErrorMessage('Description cannot exceed 1000 characters');
                                    }
                                }}
                                />
                                <div className="cancel-save">
                                    <button className="button" onClick={() => {
                                        setIsEditingDescription(false);
                                        setDescription('');
                                        setErrorMessage('');
                                    }}>Cancel</button>
                                    <button className="button" onClick={(e) => {
                                        e.preventDefault();
                                        handleUpdateDescription()
                                    }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="chat-name">
                                <p className="text24">{group.description}</p> 
                                <button className="button" onClick={() => {
                                    setIsEditingDescription(true);
                                    setDescription(group.description);
                                }}>Change description</button>
                            </div>
                        )}
                    </div>
                    <div className="option-toggle">
                        <button className={group.isPrivate === false ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); togglePrivate();}}>Public</button>
                        <button className={group.isPrivate === true ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); togglePrivate();}}>Private</button>
                    </div>
                </div>
            </div>
            <div className="error-message">{errorMessage}</div>
        </div>
    );
}

export default GroupProfileView;