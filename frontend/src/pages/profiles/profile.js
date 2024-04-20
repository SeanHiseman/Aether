import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ManageFriendshipButton from '../../components/manageFriendship';
import PersonalProfile from './personal_profile';
import ProfileFeed from './profileFeed';
import FollowerChangeButton from '../../components/followerChangeButton';

function Profile() {
    const [channels, setChannels] = useState([]);
    //const [errorMessage, setErrorMessage] = useState('');
    const [profile, setProfile] = useState('');
    const { user } = useContext(AuthContext);
    const { username, channel_name } = useParams();
    const navigate = useNavigate();

    //Determine if logged in user is viewing their own profile
    const loggedInUsername = user?.username;
    const isLoggedInUser = username === loggedInUsername;
    useEffect(() => {
        if (!isLoggedInUser) {
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
                });
        }
    }, [username, isLoggedInUser, navigate]);

    //Check if profile is private and user is not friends
    const isPrivateNotFriend = !profile.isFriend && profile.isPrivate;

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
    if (isPrivateNotFriend) {
        <header id="profile-header">
            <ManageFriendshipButton userId={loggedInUserId} receiverProfileId={profile.profileId} receiverUserId={profile.userId} isRequestSent={profile.isRequested} isFriend={profile.isFriend} />
            <div id="profile-header-side">
            </div>
            <div id="viewed-profile-info">
                <p className="large-text">{profile.username}</p>
                <p id="profile-bio">{profile.bio}</p>
            </div>
            <p>{profile.followerCount} followers</p>
            <div id="profile-header-photo">
                <img className="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" />         
            </div>
        </header>  
    } else return (
        <div className="profile-container">
            <div className="content-feed">
                <header id="profile-header">
                    {profile.isPrivate ? (
                        null
                    ) : (
                        <div id="follow-info">
                            <p>{profile.followerCount} followers</p>
                            <FollowerChangeButton userId={loggedInUserId} profileId={profile.profileId} isFollowing={profile.isFollowing} />
                        </div>
                    )}
                    <ManageFriendshipButton userId={loggedInUserId} receiverProfileId={profile.profileId} receiverUserId={profile.userId} isRequestSent={profile.isRequested} isFriend={profile.isFriend} />
                    <div id="profile-header-side">
                    </div>
                    <div id="viewed-profile-info">
                        <p className="large-text">{profile.username}</p>
                        <p id="profile-bio">{profile.bio}</p>
                    </div>
                    <div id="profile-header-photo">
                        <img className="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" />         
                    </div>
                </header>
                <div className="channel-feed">
                    {channelRender ? (
                        <ProfileFeed channelId={channelRender.channel_id} isGroup={false} locationId={profile.profileId} />
                    ) : null}
                </div>
            </div>
            <div id="right-aside">
                <h1>{channel_name}</h1>
                <h2>Channels</h2>
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
            </div>
        </div>
    );
}

export default Profile;
