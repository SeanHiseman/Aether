import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ChannelButton from '../../components/channelButton';
import ChatChannel from '../general/chatChannel';
import ContentWidget from '../content_widget'; 
import PersonalProfile from './personal_profile';
import PostChannel from '../general/postChannel';
import SendFriendRequestButton from '../../components/sendFriendRequest';
import '../../css/profile.css';

function Profile() {
    const { user } = useContext(AuthContext);
    const { username, channel_name } = useParams();
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [profile, setProfile] = useState({ profileId: '', profilePhoto: '', username: '', userId: '', isFriend: '', isRequested: '' });
    const [userContent, setUserContent] = useState([]);
    //Determine if logged in user is viewing their own profile
    const loggedInUsername = user?.username;
    const isLoggedInUser = username === loggedInUsername;
    useEffect(() => {
        if (!isLoggedInUser) {
            axios.get(`/api/profile/${username}`)
                .then(response => {
                    const fetchedProfile = response.data.profile;
                    setProfile(fetchedProfile);
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
    }, [username, isLoggedInUser, navigate]);

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

    const channelRender = channels.find(c => c.channel_name === channel_name);
    
    //Loads page for if the user is viewing their own profile
    if (isLoggedInUser) {
        return <PersonalProfile />
    }
    const loggedInUserId = user.userId;
    document.title = profile.username || "Profile";
    return (
        <div className="profile-container">
            <div className="content-feed">
                <header id="profile-header">
                    <SendFriendRequestButton userId={loggedInUserId} receiverUserId={profile.userId} isRequestSent={profile.isRequested} />
                    <div id="profile-header-side">
                    </div>
                    <div id="viewed-profile-info">
                        <p className="large-text">{profile.username}</p>
                        <p id="profile-bio">{profile.bio}</p>
                    </div>
                    <div id="profile-header-photo">
                        <img id="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile Picture" />         
                    </div>
                </header>
                <div className="channel-feed">
                    {channelRender ? (
                        channelRender.is_posts ? (
                        <PostChannel channel={channelRender} channelName={channelRender.channel_name} />
                    ) : (
                        <ChatChannel channel={channelRender} channelName={channelRender.channel_name} />
                    )
                ) : null}
                </div>
            </div>
            <div id="right-aside">
                <h2>Channels</h2>
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                        <li key={channel.channelId}>
                            {<ChannelButton is_posts={channel.is_posts} channel_name={channel.channel_name} name={profile.username} is_group={false} />}
                        </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default Profile;
