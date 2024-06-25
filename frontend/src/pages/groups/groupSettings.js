import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function GroupSettings() {
    const [errorMessage, setErrorMessage] = useState('');
    const [groupDetails, setGroupDetails] = useState('');
    const { group_name } = useParams();
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [newDescription, setDescription] = useState('');
    const [newName, setName] = useState('');

    //Loads group info 
    useEffect(() => {
        const fetchGroupData = () => {
            axios.get(`/api/group/${group_name}`)
                .then(response => {
                    const groupData = response.data;
                    setGroupDetails({
                        isMember: groupData.isMember,
                        groupId: groupData.group_id,
                        groupName: groupData.group_name,
                        description: groupData.description,
                        groupPhoto: groupData.group_photo,
                        memberCount: groupData.member_count,
                        isPrivate: groupData.is_private,
                        isRequestSent: groupData.isRequestSent,
                        userId: groupData.userId
                    });
                })
                .catch(error => {
                    setErrorMessage("Error fetching group details:", error);
                });
            };
        fetchGroupData();
    }, [group_name]);

    //Set name in text area to current description
    useEffect(() => {
        if (isEditingName) {
            setName(groupDetails.groupName);
        }
    }, [isEditingName, groupDetails.groupName]);

    //Set description in text area to current description
    useEffect(() => {
        if (isEditingDescription) {
            setDescription(groupDetails.description);
        }
    }, [isEditingDescription, groupDetails.description]);

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
            const response = await axios.put(`/api/update_group_photo/${groupDetails.groupId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },    
            })
            setGroupDetails(prevDetails => ({
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
                groupId: groupDetails.groupId
            });
            setGroupDetails({ ...groupDetails, description: newDescription });
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
                groupId: groupDetails.groupId
            });
            setGroupDetails({ ...groupDetails, groupName: newName });
            setIsEditingName(false);
        }
        catch (error) {
            setErrorMessage('Error changing name:', error);
        }
    }; 
    
    //Changes group between public and private
    const togglePrivate = async () => {
        try {
            const group_id = groupDetails.groupId;
            const response = await axios.post('/api/toggle_private_group', { group_id });
            setGroupDetails(prevDetails => ({
                ...prevDetails, 
                isPrivate: response.data.is_private
            }));
        } catch (error) {
            setErrorMessage('Error changing private status:', error);
        }
    };

    document.title = "Settings";
    return (
        <div className="group-container">  
            <div className="content-feed">
                <header id="group-header">
                    <div id="group-members">
                        <button className="button" onClick={() => togglePrivate()}>{groupDetails.isPrivate ? "Group: private" : "Group: public"}</button>
                    </div>
                    <div id="group-text">
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
                                    <p className="large-text">{groupDetails.groupName}</p>
                                    <button className="button" onClick={() => setIsEditingName(true)}>Edit</button>
                                </div>
                            )}
                        </div>
                        <div id="description-section">
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
                                    <p id="description">{groupDetails.description}</p>
                                    <button className="button" onClick={() => setIsEditingDescription(true)}>Edit</button>
                                </div>
                            )}
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </div>
                    </div>
                    <div id="profile-header-photo">
                        <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
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
                </header>  
                <div className="channel-feed">
                    <p>content here</p>
                </div>
            </div>  
            <aside id="right-aside">
                <h2>Settings</h2>
                <p>Group profile</p>
            </aside> 
        </div>
    );
}

export default GroupSettings;