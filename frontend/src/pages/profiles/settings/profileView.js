import axios from 'axios';
import React, { useEffect, useState } from 'react';

const ProfileView = ({ profile, setProfile }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [newBio, setBio] = useState('');
    const [newName, setName] = useState('');
    const [profilePhotoFile, setProfilePhotoFile] = useState('No file chosen');

    //Set name in text area to current description
    useEffect(() => {
        if (isEditingName) {
            setName(profile.username);
        }
    }, [isEditingName, profile.username]);

    //Set bio in text area to current bio
    useEffect(() => {
        if (isEditingBio) {
            setBio(profile.bio);
        }
    }, [isEditingBio, profile.bio]);

    const ChangeProfilePhoto = async (event) => {
        try {
            event.preventDefault();
            const fileInput = document.getElementById('new-profile-photo');
            if (!fileInput.files[0]) {
                setErrorMessage('Please upload an image');
                return;
            }
            const formData = new FormData();
            formData.append('new_profile_photo', fileInput.files[0]);
            const response = await axios.put(`/api/update_profile_photo/${profile.profileId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }, 
            })
            setProfile(prevDetails => ({
                ...prevDetails,
                profilePhoto: response.data.newPhotoPath
            }));
            setIsPhotoFormVisible(false);
        } catch(error) {
           setErrorMessage('Error updating photo');
        };
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setProfilePhotoFile(file.name);
            setIsFileSelected(true);
        } else {
            setProfilePhotoFile('No file chosen');
            setIsFileSelected(false);
        }
    };

    //Changes profile bio
    const handleUpdateBio = async () => {
        try {
            await axios.post('/api/change_bio', {
                bio: newBio,
                profileId: profile.profileId
            });
            setProfile({ ...profile, bio: newBio});
            setIsEditingBio(false);
        }
        catch (error) {
            setErrorMessage('Error changing bio');
        }
    }; 

    //Changes username
    const handleUpdateName = async () => {
        try {
            await axios.post('/api/change_username', {
                username: newName,
                userId: profile.userId
            });
            setProfile({ ...profile, username: newName });
            setIsEditingName(false);
        }
        catch (error) {
            setErrorMessage('Error changing name');
        }
    }; 

    const togglePhotoForm = () => {
        if (isPhotoFormVisible) {
            setErrorMessage('');
            setProfilePhotoFile('No file selected');
            setIsFileSelected(false);
        }
        setIsPhotoFormVisible(!isPhotoFormVisible);
    };

    //Changes profile between public and private
    const togglePrivate = async () => {
        try {
            const response = await axios.post('/api/toggle_private', { locationId: profile.profileId, isGroup: false });
            setProfile(prevDetails => ({
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
                    <img className="settings-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" />
                    <button className="button" onClick={togglePhotoForm}>
                        {isPhotoFormVisible ? 'Close' : 'Change Profile Photo'}
                    </button>
                    {isPhotoFormVisible && (
                        <form className="change-profile-photo" onSubmit={ChangeProfilePhoto}>
                            <div className="file-input">
                                <label htmlFor="new-profile-photo" className="dark-button">Change feed photo</label>
                                <input type="file" id="new-profile-photo" name="Profile photo" accept="image/*" onChange={handleFileChange} hidden/>
                                <span className="file-name">{profilePhotoFile}</span>
                            </div>
                            <input className={isFileSelected ? 'dark-button' : 'dark-button-disabled'} type="submit" value="Update" disabled={!isFileSelected}/>
                        </form>
                    )}
                </div>
                <div className="viewed-profile-info">
                    <div className="chat-change">
                        {isEditingName ? (
                            <div className="change-name">
                                <textarea className="change-name-area long" value={newName} placeholder="Username..." onChange={(e) => {
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
                                <p className="text36">{profile.username}</p> 
                                <button className="button" onClick={() => {
                                    setIsEditingName(true);
                                    setName(profile.username);
                                }}>Change username</button>
                            </div>
                        )}
                    </div>
                    <div className="chat-change">
                        {isEditingBio ? (
                            <div className="change-name">
                                <textarea className="change-text-area" value={newBio} placeholder="Bio..." onChange={(e) => {
                                    e.preventDefault();
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 1000) {
                                        setBio(input)
                                    } else {
                                        setErrorMessage('Bio cannot exceed 1000 characters');
                                    }
                                }}
                                />
                                <div className="cancel-save">
                                    <button className="button" onClick={() => {
                                        setIsEditingBio(false);
                                        setBio('');
                                        setErrorMessage('');
                                    }}>Cancel</button>
                                    <button className="button" onClick={(e) => {
                                        e.preventDefault();
                                        handleUpdateBio()
                                    }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="chat-name">
                                <p className="text24">{profile.bio}</p> 
                                <button className="button" onClick={() => {
                                    setIsEditingBio(true);
                                    setBio(profile.bio);
                                }}>Change bio</button>
                            </div>
                        )}
                    </div>
                    <div className="option-toggle">
                        <button className={profile.isPrivate === false ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); togglePrivate();}}>Public</button>
                        <button className={profile.isPrivate === true ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); togglePrivate();}}>Private</button>
                    </div>
                </div>  
            </div>
            <div className="error-message">{errorMessage}</div>
        </div> 
    );
};

export default ProfileView;