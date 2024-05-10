import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PostChannel from '../../components/channels/postChannel';
import PostForm from '../../components/postForm';

//Loads the profile page of the logged in user
const PersonalProfile = () => {
    const { username, channel_name } = useParams();
    const [channels, setChannels] = useState([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [friendRequests, setFriendRequests] = useState('');
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [newBio, setBio] = useState('');
    const [newName, setName] = useState('');
    const [profile, setProfile] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
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

    //Fetch channels in user profile
    useEffect(() => {
        axios.get(`/api/get_profile_channels/${profile.profileId}`)
        .then(response => {
            if (Array.isArray(response.data)) {
                setChannels(response.data);
            } else {
                setChannels([]);
            }
        })
        .catch(error => {
            console.error('Error fetching channels data:', error);
            setChannels([]);
        });
    }, [profile.profileId]);   
    
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

    //Adds channel to profile
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/add_profile_channel', {
                channel_name: newChannelName,
                profileId: profile.profileId,
                isPosts: true
            });
            if (response.data && response.status === 201) {
                setChannels([...channels, response.data]);
                setNewChannelName('');
                setErrorMessage('');
            } else {
                setErrorMessage('Failed to add channel. Please try again.');
            }
        } catch (error) {
            setErrorMessage(error.response ? error.response.data.error : 'Failed to add channel. Please try again.');
        }
    };  

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
    
    const channelRender = channels.find(c => c.channel_name === channel_name);

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

    const deleteChannel = async () => {
        try {
            //Main channels are default, so can't be deleted
            if (channel_name === 'Main') {
                return;
            } else {
                await axios.delete(`/api/delete_profile_channel`, { data: {channel_name: channel_name, profile_id: profile.profileId} });
            }
        } catch (error) {
            console.error('Error deleting channel:', error);
        }
    };

    const getFriendRequests = async () => {
        if (!showFriendRequests) {
            try {
                const response = await axios.get('/api/get_friend_requests');
                setFriendRequests(response.data);
            } catch (error) {
                setErrorMessage('Error fetching friend requests:', error);
            }
        }
        setShowFriendRequests(!showFriendRequests);
    };

    const handleFriendRequest = async (request, result) => {
        try {
            if (result === 'Accept') {
                await axios.post('/api/accept_friend_request', {request} )
            } else if (result === 'Reject') {
                await axios.delete('/api/reject_friend_request', {
                    data: {request}
                });
            }
            getFriendRequests();
        } catch (error) {
            setErrorMessage("Error handling request:", error);
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

    //Uploads content 
    const handlePostSubmit = async (formData) => {
        formData.append('profile_id', profile.profileId);
        formData.append('channel_id', channelRender.channel_id);
        try {
            await axios.post('/api/create_profile_post', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
            });
            setShowPostForm(false);
        } catch (error) {
            setErrorMessage("Error creating post:", error);
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

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => {
        setShowChannelForm(!showChannelForm)
    }

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

    document.title = profile.username || "Profile";
    return (
        <div className="profile-container">
            <div className="content-feed">
                <header id="profile-header">
                    <div id="profile-options">
                        <button className="button" onClick={getFriendRequests}>
                            {showFriendRequests ? 'Close requests' : 'See friend requests'}
                        </button>
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
                <div className="channel-feed">
                    {showFriendRequests ? (
                        <div>
                            <h2>Friend Requests</h2>
                            {friendRequests.length === 0 ? (
                                <p>No pending requests</p>
                            ) : (
                                <ul>
                                    {friendRequests.map((request, index) => (
                                        <li key={index}>
                                            {request.sender.username}
                                            <button className="button" onClick={() => handleFriendRequest(request, 'Accept')}>
                                                Accept friend request
                                            </button>
                                            <button className="button" onClick={() => handleFriendRequest(request, 'Reject')}>
                                                Reject friend request
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>                                                                                                                    
                    ) : (
                        showPostForm ? (
                            <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                        ) : ( channelRender ? (
                            <PostChannel 
                                channelId={channelRender.channel_id} 
                                channelName={channelRender.channel_name} 
                                isGroup={false} 
                                locationId={profile.profileId}/>
                        ) : null
                        )
                    )}
                </div>
            </div>
            <div id="right-aside">
                <h1>{channel_name}</h1>
                {showPostForm && (
                    <div>
                        <button class="button" onClick={() => setShowPostForm(false)}>Close</button>
                    </div>
                )}
                {!showPostForm && (
                       <button class="button" onClick={() => setShowPostForm(true)}>Create Post</button>
                )}
                <h2>Channels</h2>
                <div id="add-channel-section">
                    <button class="button" onClick={toggleChannelForm}>
                        {showChannelForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showChannelForm && (
                        <form id="add-channel-form" onSubmit={AddChannel}>
                            <input className="channel-input" type="text" name="channel_name" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                            <input className="button" type="submit" value="Add" disabled={!newChannelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                            <li key={channel.channelId}>
                                <Link to={`/profile/${profile.username}/${channel.channel_name}`}>
                                    <div className="channel-link">{channel.channel_name}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                {channel_name !== 'Main' && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button>
                )}
            </div>
        </div>
    );
}

export default PersonalProfile;
