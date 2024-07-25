import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ManageFriendshipButton from '../../components/manageFriendship';
import PostForm from '../../components/postForm';
import ProfileFeed from './profileFeed';
import FollowerChangeButton from '../../components/followerChangeButton';

function Profile() {
    const [channels, setChannels] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [profile, setProfile] = useState('');
    const [showPostForm, setShowPostForm] = useState(false);
    const { user } = useContext(AuthContext);
    const { username, channel_name } = useParams();
    const loggedInUserId = user.userId;
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

    //Check if profile is private and user is not friends
    const isPrivateNotFriend = !profile.isFriend && profile.isPrivate;
    document.title = profile.username || "Profile";

    return (
        <div className="profile-container">
            <div className="content-feed">
                <div className="channel-feed">
                    {showPostForm ? (
                        <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                    ) : (
                        channelRender && !isPrivateNotFriend ? (
                            <ProfileFeed channelId={channelRender.channel_id} isGroup={false} locationId={profile.profileId} />
                        ) : <p className="large-text">This profile is private</p>
                    )}
                </div>
            </div>
            <div id="right-aside">
                <div id="profile-summary">
                    {isLoggedInUser &&(
                        <Link to={`/settings/${username}`}>
                            <button className="button">Settings</button>
                        </Link>
                    )}
                    <img className="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" /> 
                    <p className="large-text">{profile.username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                    <p id="user-count">{profile.followerCount} {profile.followerCount === 1 ? 'follower' : 'followers'}</p>
                    {!isLoggedInUser && !profile.isPrivate && (<FollowerChangeButton userId={loggedInUserId} profileId={profile.profileId} isFollowing={profile.isFollowing} />)}
                    <ManageFriendshipButton userId={loggedInUserId} receiverProfileId={profile.profileId} receiverUserId={profile.userId} isRequestSent={profile.isRequested} isFriend={profile.isFriend} />
                </div>
                <p className="large-text">{channel_name}</p>
                {isLoggedInUser &&(
                    showPostForm ? (
                        <div>
                            <button class="button" onClick={() => setShowPostForm(false)}>Close</button>
                        </div>
                    ) : (
                        <button class="button" onClick={() => setShowPostForm(true)}>Create Post</button>
                    )
                )}
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
};

export default Profile;
