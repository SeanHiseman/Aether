import axios from 'axios';
import React, { useEffect, useState } from 'react';

function GroupProfileView({ group, setGroup }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
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
            formData.append('new_group_photo', fileInput.files[0]);
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
        } catch(error) {
                setErrorMessage('Error updating photo', error.response ? error.response.data : error);
        };
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
            setErrorMessage(`Error changing description: ${error}`);
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
            setErrorMessage('Error changing name:', error);
        }
    }; 
    
    //Changes group between public and private
    const togglePrivate = async () => {
        try {
            const group_id = group.groupId;
            const response = await axios.post('/api/toggle_private_group', { group_id });
            setGroup(prevDetails => ({
                ...prevDetails, 
                isPrivate: response.data.is_private
            }));
        } catch (error) {
            setErrorMessage('Error changing private status:', error);
        }
    };

    return (
        <div id="profile-settings">  
            <div id="name-photo-area">
                <div id="profile-header-photo">
                    <img id="settings-profile-photo" src={`/${group.groupPhoto}`} alt={group.groupName} />
                    <button className="button" onClick={() => setIsPhotoFormVisible(!isPhotoFormVisible)}>
                        {isPhotoFormVisible ? 'Close' : 'Change Group photo'}
                    </button>
                    {isPhotoFormVisible && (
                        <form id="change-group-photo" action="/api/update_group_photo" method="post" enctype="multipart/form-data" onSubmit={ChangeGroupPhoto}>
                            <label htmlFor="new_group_photo">Change Group photo:</label>
                            <input type="file" id="new_group_photo" name="new_group_photo" accept="image/*" />
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                            <input className="button" type="submit" value="Update" />
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
                                    if (inputLength <= 100) {
                                        setName(input)
                                    } else {
                                        setErrorMessage('Name cannot exceed 100 characters.');
                                    }
                                }}
                                />
                                <button className="button" onClick={() => {setIsEditingName(false); handleUpdateName();}}>Save</button>
                            </div>
                        ) : (
                            <div className="view-name">
                                <p className="large-text">{group.groupName}</p>
                                <button className="button edit" onClick={() => setIsEditingName(true)}>Change group name</button>
                            </div>
                        )}
                    </div>
                    <div id="bio-section">
                        {isEditingDescription ? (
                            <div className="change-description">
                                <button className='button' onClick={() => setIsEditingDescription(false)}>Close</button>
                                <textarea className="change-text-area" value={newDescription} onChange={(e) => {
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
                                <button className="button" onClick={() => setIsEditingDescription(true)}>Edit</button>
                            </div>
                        )}
                        {errorMessage && <div className="error-message">{errorMessage}</div>}
                    </div>
                </div>
            </div>
            <div id="private-toggle">
                <button className="button" onClick={() => togglePrivate()}>{group.isPrivate ? "Group: private" : "Group: public"}</button>
            </div>
        </div>
    );
}

export default GroupProfileView;