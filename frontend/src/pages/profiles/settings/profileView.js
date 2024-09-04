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
            const fileInput = event.target.elements.new_profile_photo;
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
        <div id="profile-settings">
            <div id="name-photo-area">
                <div id="profile-header-photo">
                    <img id="settings-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" />
                    <button className="button" onClick={togglePhotoForm}>
                        {isPhotoFormVisible ? 'Close' : 'Change Profile Photo'}
                    </button>
                    {isPhotoFormVisible && (
                        <form className="change-profile-photo" onSubmit={ChangeProfilePhoto}>
                            <div className="file-input">
                                <label htmlFor="new-profile-photo" class="dark-button">Change feed photo</label>
                                <input type="file" id="new-profile-photo" name="Profile photo" accept="image/*" onChange={handleFileChange} hidden/>
                                <span className="file-name">{profilePhotoFile}</span>
                            </div>
                            <input className={isFileSelected ? 'dark-button' : 'dark-button-disabled'} type="submit" value="Update" disabled={!isFileSelected}/>
                        </form>
                    )}
                </div>
                <div id="viewed-profile-info">
                    <div id="name-section">
                        {isEditingName ? (
                            <div className="change-name">
                                <button className="button" onClick={() => setIsEditingName(false)}>Close</button>
                                <textarea className="change-name-area" value={newName} placeholder="New name" onChange={(e) => {
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 30) {
                                        setName(input)
                                    } else {
                                        setErrorMessage('Name cannot exceed 30 characters');
                                    }
                                }}
                                />
                                <button className="button" onClick={() => {setIsEditingName(false); handleUpdateName();}}>Save</button>
                            </div>
                        ) : (
                            <div className="view-name">
                                <p className="large-text">{profile.username}</p>
                                <button className="button edit" onClick={() => setIsEditingName(true)}>Change username</button>
                            </div>
                        )}
                    </div>
                    <div id="bio-section">
                        {isEditingBio ? (
                            <div className="change-bio">
                                <button className='button' onClick={() => setIsEditingBio(false)}>Close</button>
                                <textarea className="change-text-area" value={newBio} placeholder="Bio..." onChange={(e) => {
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 1000) {
                                        setBio(input)
                                    } else {
                                        setErrorMessage('Bio cannot exceed 1000 characters.');
                                    }
                                }}
                                />
                                <button className="button" onClick={() => {setIsEditingBio(false); handleUpdateBio();}}>Save</button>
                            </div>
                        ) : (
                            <div className="view-bio">
                                <p id="profile-bio-settings">{profile.bio}</p>
                                <button className="button edit" onClick={() => setIsEditingBio(true)}>Edit bio</button>
                            </div>
                        )}
                        <div className="error-message">{errorMessage}</div>
                    </div>
                </div>  
            </div>
            <div id="private-toggle">
                <button className="button" onClick={() => togglePrivate()}>{profile.isPrivate ? "Feed: private" : "Feed: public"}</button>  
            </div>
        </div> 
    );
};

export default ProfileView;