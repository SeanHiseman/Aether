import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChatChannel from '../groups/chatChannel';
import ContentWidget from '../content_widget'; 
import FriendRequests from '../../components/friendRequestsList';
import PostChannel from '../groups/postChannel';
import PostForm from '../../components/postForm';
import '../../css/profile.css';

//Loads the profile page of the logged in user
const PersonalProfile = () => {
    const { username, channel_name } = useParams();
    const [channels, setChannels] = useState([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [newBio, setBio] = useState('');
    const [profile, setProfile] = useState({ profileId: '', profilePhoto: '', username: '', bio: '', userId: ''});
    const [newName, setName] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [userContent, setUserContent] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`/api/profile/${username}`)
            .then(response => {
                //This code doesn't work for some reason
                //if (!response.ok) {
                    //throw new Error('Network response was not ok');
                //}
                //return response.json();
            //})
            //.then(data => {
                //setProfile({
                    //bio: data.bio,
                    //profileId: data.profileId,
                    //profilePhoto: data.profilePhoto,
                    //username: data.username
                //});
            //}).catch(error => {
                //console.error('Fetch error:', error);
            //})
        //}, [username]);
                const fetchedProfile = response.data.profile;
                setProfile(fetchedProfile);
                axios.get(`/api/user-content/${fetchedProfile.profile_id}`)
                    .then(contentResponse => {
                        setUserContent(contentResponse.data);
                    })
                    .catch(contentError => {
                        console.error('Error fetching user content:', contentError);
                    });
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

    //Adds channel to profile
    const AddChannel = async (event) => {
        event.preventDefault();
        const channelName = event.target.elements.channel_name.value;
        try {
            const response = await axios.post('/api/add_profile_channel', {
                channel_name: channelName,
                profileId: profile.profileId,
                isPosts: isPostChannel
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

    const ChangeProfilePhoto = (e) => {
        e.preventDefault();
        const fileInput = e.target.elements.new_profile_photo;
        if (!fileInput.files[0]) {
            setErrorMessage('Please upload an image');
            return;
        }
        const formData = new FormData();
        formData.append('new_profile_photo', fileInput.files[0]);
    
        axios.post(`/api/update_profile_photo/${profile.profileId}`, formData)
            .then(response => {
                //document.getElementById('large-profile-photo').src = response.data.newPhotoPath;
                setErrorMessage('');
                setIsPhotoFormVisible(false);
            }).catch(error => {
                setErrorMessage('Error updating photo', error.response ? error.response.data : error);
            });
    }
    
    const channelRender = channels.find(c => c.channel_name === channel_name);

    const UploadSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!formData.get('Upload')) {
            alert('No file has been uploaded.');
            return;
        }
        axios.post('/upload', formData)
        .then(response => {
            console.log('Content uploaded: ', response.data);
        }).catch(error => {
            console.error('Error uploading content: ', error);
        });
    }

    const handleLogout = (e) => {
        e.preventDefault();
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

    //Set channels to contain either posts or chats
    const handleChatClick = () => setIsPostChannel(false);
    const handlePostClick = () => setIsPostChannel(true);

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
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    document.title = profile.username || "Profile";
    return (
        <div className="profile-container">
            <div className="content-feed">
                <header id="profile-header">
                    <FriendRequests />
                    <div id="profile-header-side">
                        <PostForm />
                    </div>
                    <div id="viewed-profile-info">
                        <div id="name-section">
                            {isEditingName ? (
                                <div className="change-name">
                                    <button className='light-button' onClick={() => setIsEditingName(false)}>Close</button>
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
                                    <button className="light-button" onClick={() => {setIsEditingName(false); handleUpdateName();}}>Save</button>
                                </div>
                            ) : (
                                <div className="view-name">
                                    <p className="large-text">{profile.username}</p>
                                    <button className="light-button" onClick={() => setIsEditingName(true)}>Edit</button>
                                </div>
                            )}
                        </div>
                        <div id="bio-section">
                            {isEditingBio ? (
                                <div className="change-bio">
                                    <button className='light-button' onClick={() => setIsEditingBio(false)}>Close</button>
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
                                    <button className="light-button" onClick={() => {setIsEditingBio(false); handleUpdateBio();}}>Save</button>
                                </div>
                            ) : (
                                <div className="view-bio">
                                    <p id="profile-bio">{profile.bio}</p>
                                    <button className="light-button" onClick={() => setIsEditingBio(true)}>Edit</button>
                                </div>
                            )}
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </div>

                        <form action="/api/logout" method="post" onSubmit={handleLogout}>
                            <button className="light-button" type="submit">Logout</button>
                        </form>
                    </div>
                    <div id="profile-header-photo">
                        <img id="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile Picture" />
                        <button className="light-button" onClick={() => setIsPhotoFormVisible(!isPhotoFormVisible)}>
                            {isPhotoFormVisible ? 'Close' : 'Change Profile Photo'}
                        </button>
                        {isPhotoFormVisible && (
                            <form id="change-profile-photo" action="/api/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={ChangeProfilePhoto}>
                                <label htmlFor="new_profile_photo">Change Profile Photo:</label>
                                <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
                                {errorMessage && <div className="error-message">{errorMessage}</div>}
                                <input className="light-button" type="submit" value="Update" />
                            </form>
                        )}
                    </div>
                </header>
                <div className="channel-feed">
                    {channelRender && channelRender.is_posts ? (
                        <PostChannel channel={channelRender} />
                    ) : (
                        <ChatChannel channel={channelRender} />
                    )}
                </div>
            </div>
            {/*<div className="results-wrapper">
                <div id="results">
                    {Array.isArray(userContent) && userContent.map(item => (
                        <ContentWidget key={item.post_id} item={item} />
                    ))}
                </div>
            </div>*/}
            <div id="right-aside">
                <h2>Channels</h2>
                <div id="add-channel-section">
                    <button class="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showForm && (
                        <form id="add-channel-form" onSubmit={AddChannel}>
                            <input className="channel-input" type="text" name="channel_name" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                            <p>Channel type:</p>
                            <div id="post-chat-section">
                                <button type="button" class="button" onClick={handlePostClick}>Post</button>
                                <button type="button" class="button" onClick={handleChatClick}>Chat</button>
                            </div>
                            <input className="button" type="submit" value="Add" disabled={!newChannelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                        <li key={channel.channelId}>
                            {<Link className="channel-list-link" to={`/profile/${profile.username}/${channel.channel_name}`}>
                                <p className="channel-list-text">{channel.channel_name}</p>
                            </Link>}
                        </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default PersonalProfile;
