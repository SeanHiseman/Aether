import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ContentWidget from '../content_widget'; 
import PersonalProfile from './personal_profile';
import SendFriendRequestButton from '../../components/sendFriendRequest';
import '../../css/profile.css';

function Profile() {
    const { user } = useContext(AuthContext);
    const { username } = useParams();
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [profile, setProfile] = useState({ logged_in_profile_id: '', logged_in_profile_photo: '', logged_in_username: '',logged_in_user_id: ''});
    const [userContent, setUserContent] = useState([]);
    //Determine if logged in user is viewing their own profile
    const loggedInUsername = user?.username;
    const isLoggedInUser = username === loggedInUsername;
    useEffect(() => {
        if (!isLoggedInUser) {
            axios.get(`/api/profile/${username}`)
                .then(response => {
                    setProfile(response.data.profile);
                    axios.get(`/api/user-content/${response.data.profileId}`)
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

    //Fetch channels in user profile
    useEffect(() => {
        axios.get(`/api/get_profile_channels/${profile.profileId}`)
        .then(response => {
            if (Array.isArray(response.data)) {
                setChannels(response.data);
            } else {
                console.error('Expected an array for channels, received: ', response.data)
                setChannels([]);
            }
        })
        .catch(error => {
            console.error('Error fetching channels data:', error);
            setChannels([]);
        });
    }, [profile.profileId]);    

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
                    <img id="large-profile-image" src={`/${profile.profilePhoto}`} alt="Profile Picture" />         
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
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                        <li key={channel.channelId}>
                            <p className="channel-list-text">{channel.channel_name}</p>
                            {/*<Link className="channel-list-link" to={`/profile_channels/${channel.channelName}`}>
                                <p className="channel-list-text">{channel.channelName}</p>
                            </Link>*/}
                        </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default Profile;
