import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ChannelName from '../../components/channels/channelName';
import ManageFriendshipButton from '../../components/manageFriendship';
import PostForm from '../../components/postForm';
import ProfileFeed from './profileFeed';
import FollowerChangeButton from '../../components/followerChangeButton';

function Profile() {
    const [channels, setChannels] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [newChannelName, setNewChannelName] = useState('');
    const [profile, setProfile] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const { user } = useContext(AuthContext);
    const { username, channel_name } = useParams();
    const loggedInUserId = user.userId;
    const navigate = useNavigate();

    //Determine if logged in user is viewing their own profile
    const loggedInUsername = user?.username;
    const isLoggedInUser = username === loggedInUsername;

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
            });
    }, [username, navigate, channel_name]);

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
            setErrorMessage('Error fetching channels data', error);
            setChannels([]);
        });
    }, [profile.profileId]);    

    //Adds channel to profile
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName === 'Main') {
                setErrorMessage("Chats cannot be named Main");
                return;
            } else {
                const response = await axios.post('/api/add_profile_channel', {
                    channel_name: newChannelName,
                    profileId: profile.profileId,
                    isPosts: true
                });
                if (response.data && response.status === 201) {
                    setChannels([...channels, response.data]);
                    setNewChannelName('');
                    setErrorMessage('');
                    setShowChannelForm(false);
                    navigate(`/profile/${username}/${newChannelName}`);
                } else {
                    setErrorMessage('Failed to add channel. Please try again');
                }
            }
        } catch (error) {
            setErrorMessage('Failed to add channel. Please try again');
        }
    };  
    
    //Accesses data about current channel
    const channelRender = channels.find(c => c.channel_name === channel_name);

    //Updates list of channels when channel name changed
    const channelUpdate = (channelId, newName) => {
        setChannels(prevChannels => 
            prevChannels.map(channel =>
                channel.channel_id === channelId ? {...channel, channel_name: newName} : channel
            )
        );
    };

    const deleteChannel = async () => {
        try {
            //Main channels are default, so can't be deleted
            if (channel_name === 'Main') {
                return;
            } else {
                await axios.delete(`/api/delete_profile_channel`, { data: {channel_name: channel_name, profile_id: profile.profileId} });
                setChannels(prevChannels => prevChannels.filter(channel => channel.channel_name !== channel_name));
                navigate(`/profile/${username}/Main`);
            }
        } catch (error) {
            setErrorMessage('Error deleting channel');
        }
    };
    
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

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => {
        setShowChannelForm(!showChannelForm)
    }

    //Check if profile is private and user is not friends
    const isPrivateNotFriend = !profile.isFriend && profile.isPrivate && !isLoggedInUser;
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
                    {isLoggedInUser && (
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
                {channelRender && (
                    isLoggedInUser ? (
                        <ChannelName channelId={channelRender.channel_id} channelName={channel_name} channelType={'profile'} locationName={username} channelUpdate={channelUpdate}/>
                    ) : (
                        <p className="text36">{channel_name}</p>  
                    )
                )}
                {channel_name !== 'Main' && isLoggedInUser && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button>
                )}
                {isLoggedInUser && (
                    showPostForm ? (
                        <div>
                            <button class="button" onClick={() => setShowPostForm(false)}>Close</button>
                        </div>
                    ) : (
                        <button class="button" onClick={() => setShowPostForm(true)}>Create Post</button>
                    )
                )}
                {isLoggedInUser && (
                    <div id="add-channel-section">
                        <button class="button" onClick={toggleChannelForm}>
                            {showChannelForm ? 'Close': 'Create new Channel'}
                        </button>
                        {showChannelForm && (
                            <form id="add-channel-form" onSubmit={AddChannel}>
                                <input className="channel-input" type="text" name="channel_name" placeholder="Channel name..." value={newChannelName} onChange={(e) => {
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 30) {
                                        setNewChannelName(input)
                                    } else {
                                        setErrorMessage('Name cannot exceed 30 characters');
                                    }
                                }}/>
                                <input className="button" type="submit" value="Add" disabled={!newChannelName}/>
                            </form>                            
                        )}
                    </div>
                )}
                <div className="error-message">{errorMessage}</div> 
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                            <li key={channel.channelId}>
                                <Link to={`/profile/${profile.username}/${channel.channel_name}`} className="channel-item">
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
