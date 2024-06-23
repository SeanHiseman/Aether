import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

//Page for all settings related to a user
const Settings = () => {
    const { username } = useParams();
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [newBio, setBio] = useState('');
    const [newName, setName] = useState('');
    const [profile, setProfile] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`/api/profile/${username}`)
            .then(response => {
                const fetchedProfile = response.data.profile;
                setProfile(fetchedProfile);
            })
            .catch(error => {
                console.error('Error:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                } 
            })
    }, [username, navigate]); 
    
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
            setErrorMessage('Error updating photo', error.response ? error.response.data : error);
        };
    }

    const deleteAccount = async () => {
        try {
            const response = await axios.delete('/api/delete_account', { data: { user_id: profile.userId } });
                if (response.data.success) {
                    navigate('/login');
                }
        } catch (error) {
            setErrorMessage('Error deleting account:', error);
        }
    };
    
    const handleLogout = (event) => {
        event.preventDefault();
        axios.post('/api/logout')
            .then(response => {
                if (response.data.success) {
                    navigate('/login');
                } else {
                    alert('Logout failed: ', response.data.message);
                }
            })
            .catch(error => {
                alert('Error during logout: ', error);
            })
    }

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
            setErrorMessage(`Error changing bio: ${error}`);
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
            setErrorMessage(`Error changing name: ${error}`);
        }
    }; 

    //Changes profile between public and private
    const togglePrivate = async () => {
        try {
            const profile_id = profile.profileId;
            const response = await axios.post('/api/toggle_private_profile', { profile_id} );
            setProfile(prevDetails => ({
                ...prevDetails,
                isPrivate: response.data.is_private
            }));
        } catch (error) {
            setErrorMessage('Error changing private status:', error);
        }
    };

    document.title = "Settings";
    return (
        <div className="profile-container">
            <div className="content-feed">
                <header id="profile-header">
                    <div id="profile-options">
                        <button className="button" onClick={() => togglePrivate()}>{profile.isPrivate ? "Profile: private" : "Profile: public"}</button>
                        <p>{profile.followerCount} followers</p>   
                    </div>
                    <form action="/api/logout" method="post" onSubmit={handleLogout}>
                        <button className="button" type="submit">Logout</button>
                    </form>
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
                                    <p className="large-text">{profile.username}</p>
                                    <button className="button" onClick={() => setIsEditingName(true)}>Edit</button>
                                </div>
                            )}
                        </div>
                        <div id="bio-section">
                            {isEditingBio ? (
                                <div className="change-bio">
                                    <button className='button' onClick={() => setIsEditingBio(false)}>Close</button>
                                    <textarea className="change-text-area" value={newBio} onChange={(e) => {
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
                                    <p id="profile-bio">{profile.bio}</p>
                                    <button className="button" onClick={() => setIsEditingBio(true)}>Edit bio</button>
                                </div>
                            )}
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </div>
                        <button className="button" onClick={deleteAccount}>Delete account</button>
                    </div>
                    <div id="profile-header-photo">
                        <img className="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" />
                        <button className="button" onClick={() => setIsPhotoFormVisible(!isPhotoFormVisible)}>
                            {isPhotoFormVisible ? 'Close' : 'Change Profile Photo'}
                        </button>
                        {isPhotoFormVisible && (
                            <form id="change-profile-photo" action="/api/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={ChangeProfilePhoto}>
                                <label htmlFor="new_profile_photo">Change Profile photo:</label>
                                <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
                                {errorMessage && <div className="error-message">{errorMessage}</div>}
                                <input className="button" type="submit" value="Update" />
                            </form>
                        )}
                    </div>
                </header>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
            </div>
            <div id="right-aside">
                <p>Settings</p>
            </div>
        </div>
    );
}

export default Settings;