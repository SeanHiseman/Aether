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
    const [profile, setProfile] = useState({ logged_in_profile_id: '', logged_in_profile_photo: '', logged_in_username: '', bio: ''});
    const [uploadStatus, setUploadStatus] = useState('');
    const [userContent, setUserContent] = useState([]);
    const navigate = useNavigate();
    const { profileId } = useParams();
    
    useEffect(() => {
        document.title = "Profile";
        axios.get(`/personal-profile/${profileId}`)
            .then(response => {
                setProfile(response.data.profile);
                axios.get(`/user-content/${response.data.logged_in_profile_id}`)
                    .then(contentResponse => {
                        console.log("Content Response Data: ", contentResponse.data)
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
    }, [profileId, navigate]);

    const handlePhotoSubmit = (e) => {
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

    const handleUploadSubmit = (e) => {
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
        axios.post('/logout')
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

    return (
        <div id="profile-container">
            <div id="profile-header">
                <div id="profile-header-photo">
                    <img id="large-profile-image" src={`/${profile.logged_in_profile_photo}`} alt="Profile Picture" />
                    <form id="change-profile-photo" action="/profiles/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={handlePhotoSubmit}>
                        <label htmlFor="new_profile_photo">Change Profile Photo:</label>
                        <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
                        <input className="profile-button" type="submit" value="Update" />
                    </form>           
                </div>
                <div id="viewed-profile-info">
                    <p id="large-username-text">{profile.logged_in_username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                    <UpdateBioButton currentBio={profile.bio} />
                </div>
                <FriendRequests />
                <div id="profile-header-side">
                    <div id="upload-section">
                        <p>Upload content</p>
                        <form id="upload-form" enctype="multipart/form-data" action="/upload" method="post" onSubmit={handleUploadSubmit}>
                            <input type="text" name="title" placeholder="Enter title" />
                            <input type="file" name="file" />
                            <input className="profile-button" type="submit" value="Upload" />
                        </form>
                        <div id="confirmation-message"></div>
                    </div>
                    <form action="/logout" method="post" onSubmit={handleLogout}>
                        <button className="profile-button" type="submit">Logout</button>
                    </form>
                </div>
            </div>
            <PostForm />
            <div className="results-wrapper">
                <div id="results">
                    {Array.isArray(userContent) && userContent.map(item => (
                        <ContentWidget key={item.post_id} item={item} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PersonalProfile;
