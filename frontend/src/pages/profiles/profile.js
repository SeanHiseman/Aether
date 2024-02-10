import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content_widget'; 
import PersonalProfile from './personal_profile';
import SendFriendRequestButton from '../../components/sendFriendRequest';
import '../../css/profile.css';
import FriendRequests from '../../components/friendRequestsList';
import PostForm from '../../components/postForm';
import UpdateBioButton from '../../components/updateBio';
function Profile() {
    const { user } = useContext(AuthContext);
    const { username } = useParams();
    const navigate = useNavigate();
    //Initialise user profile and content
    const [profile, setProfile] = useState({ logged_in_profile_id: '', logged_in_profile_photo: '', logged_in_username: '',logged_in_user_id: ''});
    const [userContent, setUserContent] = useState([]);
    //Determine if logged in user is viewing their own profile
    const loggedInUsername = user?.username;
    const isLoggedInUser = username === loggedInUsername;
    const [channelName, setChannelName] = useState('');
    const [channels, setChannels] = useState(username.channels || []);
    const [showForm, setShowForm] = useState(false);
    useEffect(() => {
        if (!isLoggedInUser) {
            axios.get(`/api/profile/${username}`)
                .then(response => {
                    setProfile(response.data.profile);
                    axios.get(`/api/user-content/${response.data.profile_id}`)
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
                });
        }
    }, [username, isLoggedInUser, navigate, loggedInUsername, profile?.username]);

    //Loads page for if the user is viewing their own profile
    if (isLoggedInUser) {
        return <PersonalProfile />
    }
    
    document.title = profile.username || "Profile";
    return (
        <div id="profile-container">
            <div id="profile-header">
                <SendFriendRequestButton />
                <div id="profile-header-side">
                </div>
                <div id="viewed-profile-info">
                    <p id="large-username-text">{profile.username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                </div>
                <div id="profile-header-photo">
                    <img id="large-profile-image" src={`/${profile.profile_photo}`} alt="Profile Picture" />         
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
            </div>
        </div>
    );
}

export default Profile;
