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
            console.log("error:", error);
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
        <div id="profile-settings">  
            <div id="name-photo-area">
                <div id="profile-header-photo">
                    <img id="settings-profile-photo" src={`/${group.groupPhoto}`} alt={group.groupName} />
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
                <div id="viewed-profile-info">
                    <div id="name-section">
                        {isEditingName ? (
                            <div className="change-name">
                                <button className='button' onClick={() => setIsEditingName(false)}>Close</button>
                                <textarea className="change-name-area" value={newName} onChange={(e) => {
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 30) {
                                        setName(input)
                                    } else {
                                        setErrorMessage('Name cannot exceed 30 characters.');
                                    }
                                }}
                                />
                                <button className="button" onClick={() => {setIsEditingName(false); handleUpdateName();}}>Save</button>
                            </div>
                        ) : (
                            <div className="view-name">
                                <p className="large-text">{group.groupName}</p>
                                <button className="button edit" onClick={() => setIsEditingName(true)}>Change feed name</button>
                            </div>
                        )}
                    </div>
                    <div id="bio-section">
                        {isEditingDescription ? (
                            <div className="change-description">
                                <button className='button' onClick={() => setIsEditingDescription(false)}>Close</button>
                                <textarea className="change-text-area" value={newDescription} placeholder="Description..." onChange={(e) => {
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 1000) {
                                        setDescription(input)
                                    } else {
                                        setErrorMessage('Description cannot exceed 1000 characters.');
                                    }
                                }}
                                />
                                <button className="button" onClick={() => {setIsEditingDescription(false); handleUpdateDescription();}}>Save</button>
                            </div>
                        ) : (
                            <div className="view-description">
                                <p id="description">{group.description}</p>
                                <button className="button" onClick={() => setIsEditingDescription(true)}>Edit description</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div id="private-toggle">
                <button className="button" onClick={() => togglePrivate()}>{group.isPrivate ? "Feed: private" : "Feed: public"}</button>
            </div>
            <div className="error-message">{errorMessage}</div>
        </div>
    );
}

export default GroupProfileView;