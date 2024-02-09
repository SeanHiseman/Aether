import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
    const [profile, setProfile] = useState({ logged_in_profile_id: '', logged_in_profile_photo: '', logged_in_username: '', bio: ''});
    const [showForm, setShowForm] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [userContent, setUserContent] = useState([]);
    const navigate = useNavigate();
    useEffect(() => {
        document.title = "Profile";
        axios.get(`/api/personal-profile/${username}`)
            .then(response => {
                setProfile(response.data.profile);
                console.log("Profile id:", response.data.logged_in_profile_id);
                axios.get(`/api/user-content/${response.data.logged_in_profile_id}`)
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

    const PhotoSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!formData.get('Update')) {
            alert('No image has been uploaded.');
            return;
        }
        axios.post('/update_profile_photo', formData)
        .then(response => {
            console.log('Photo updated: ', response.data);
        }).catch(error => {
            console.error('Error updating photo: ', error);
        });
    }

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

    //Adds channel to group
    const AddChannel = async (event) => {
        event.preventDefault();
        const channelName = event.target.elements.channel_name.value;
        try {
            const response = await axios.post('/api/add_personal_channel', {
                channel_name: channelName,
                profileId: username.profile_id
            });
            if (response.data && response.status === 200) {
                setChannels([...channels, response.data]);
            }
        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
        }
    };   

    //Toggles display of create channel form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

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
                    <p id="large-username-text">{profile.logged_in_username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                    <UpdateBioButton currentBio={profile.bio} />
                    <form action="/api/logout" method="post" onSubmit={handleLogout}>
                        <button className="light-button" type="submit">Logout</button>
                    </form>
                </div>
                <div id="profile-header-photo">
                    <img id="large-profile-image" src={`/${profile.logged_in_profile_photo}`} alt="Profile Picture" />
                    <form id="change-profile-photo" action="/profiles/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={PhotoSubmit}>
                        <label htmlFor="new_profile_photo">Change Profile Photo:</label>
                        <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
                        <input className="light-button" type="submit" value="Update" />
                    </form>           
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
                    {groupId.channels.map((channel, index) => (
                        <li key={index}>{channel}</li>
                    ))}
                    </ul>*/}
                <div id="add-channel-section">
                    <button class="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showForm && (
                        <form id="add-channel-form" action="/add_channel" method="post" onSubmit={AddChannel}>
                            <input type="text" name="Name" placeholder="Channel name" value={channelName} onChange={(e) => setChannelName(e.target.value)}/>
                            <input className="button" type="submit" value="Add" disabled={!channelName}/>
                        </form>                            
                    )}
                </div>
            </div>
        </div>
    );
}

export default PersonalProfile;
