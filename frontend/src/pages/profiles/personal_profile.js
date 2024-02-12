import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChangeProfilePhoto from '../../components/changeProfilePhoto';
import ContentWidget from '../content_widget'; 
import FriendRequests from '../../components/friendRequestsList';
import PostForm from '../../components/postForm';
import UpdateBioButton from '../../components/updateBio';
import '../../css/profile.css';

//Loads the profile page of the logged in user
const PersonalProfile = () => {
    const { username } = useParams();
    const [channels, setChannels] = useState(username.channels || []);
    const [channelName, setChannelName] = useState('');
    const [errorMessage, setErrorMessage] =useState('');
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [profile, setProfile] = useState({ profileId: '', profilePhoto: '', username: '', bio: ''});
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

    //Adds channel to profile
    const AddChannel = async (event) => {
        event.preventDefault();
        const channelName = event.target.elements.channel_name.value;
        try {
            const response = await axios.post('/api/add_profile_channel', {
                channel_name: channelName,
                profileId: profile.profileId
            });
            if (response.data && response.status === 201) {
                setChannels([...channels, response.data]);
                setChannelName('');
                setErrorMessage('');
            } else {
                setErrorMessage('Failed to add channel. Please try again.');
            }
        } catch (error) {
            setErrorMessage(error.response ? error.response.data.error : 'Failed to add channel. Please try again.');
        }
    };   

    //Toggles display of create channel form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    document.title = profile.username || "Profile";
    return (
        <div id="profile-container">
            <div id="profile-header">
                <FriendRequests />
                <div id="profile-header-side">
                    {/*<div id="upload-section">
                        <p>Upload content</p>
                        <form id="upload-form" enctype="multipart/form-data" action="/upload" method="post" onSubmit={UploadSubmit}>
                            <input type="text" name="title" placeholder="Enter title" />
                            <input type="file" name="file" />
                            <input className="light-button" type="submit" value="Upload" />
                        </form>
                        <div id="confirmation-message"></div>
                    </div>*/}
                    <PostForm />
                </div>
                <div id="viewed-profile-info">
                    <p id="large-username-text">{profile.username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                    <UpdateBioButton currentBio={profile.bio} />
                    <form action="/api/logout" method="post" onSubmit={handleLogout}>
                        <button className="light-button" type="submit">Logout</button>
                    </form>
                </div>
                <div id="profile-header-photo">
                    <img id="large-profile-image" src={`/${profile.profilePhoto}`} alt="Profile Picture" />
                    <button className="light-button" onClick={() => setIsPhotoFormVisible(!isPhotoFormVisible)}>
                        {isPhotoFormVisible ? 'Close' : 'Change Profile Photo'}
                    </button>
                    {isPhotoFormVisible && <ChangeProfilePhoto onPhotoUpdated={() => {
                        setIsPhotoFormVisible(false); 
                    }} />}
                </div>
            </div>
            <div className="results-wrapper">
                <div id="results">
                    {Array.isArray(userContent) && userContent.map(item => (
                        <ContentWidget key={item.post_id} item={item} />
                    ))}
                </div>
            </div>
            <div id="right-aside">
                <h2>Channels</h2>
                {/*<ul>
                    {user_id.channels.map((channel, index) => (
                        <li key={index}>{channel}</li>
                    ))}
                    </ul>*/}
                <div id="add-channel-section">
                    <button class="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showForm && (
                        <form id="add-channel-form" action="/add_profile_channel" method="post" onSubmit={AddChannel}>
                            <input type="text" name="channel_name" placeholder="Channel name" value={channelName} onChange={(e) => setChannelName(e.target.value)}/>
                            <input className="button" type="submit" value="Add" disabled={!channelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
            </div>
        </div>
    );
}

export default PersonalProfile;
