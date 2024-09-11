import axios from 'axios';
import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ChannelName from '../../components/channels/channelName';
import ManageFriendshipButton from '../../components/manageFriendship';
import PostChannel from '../../components/channels/postChannel';
import ContentForm from '../../components/contentForm';
import FollowerChangeButton from '../../components/followerChangeButton';

const Profile = () => {
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
        const fetchProfile = async () => {
            try {
                const response = await axios.get(`/api/profile/${username}`);
                const fetchedProfile = response.data.profile;
                setProfile(fetchedProfile);
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            }
        };

        fetchProfile();
    }, [username, navigate, channel_name]);

    //Adds channel to profile
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName === 'Main') {
                setErrorMessage("Cannot be named Main");
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
                    navigate(`/u/${username}/${newChannelName}`);
                } else {
                    setErrorMessage('Failed to add channel');
                }
            }
        } catch (error) {
            setErrorMessage('Failed to add channel');
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
                navigate(`/u/${username}/Main`);
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
            await axios.post('/api/create_post', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
            });
            setShowPostForm(false);
        } catch (error) {
            setErrorMessage("Error creating post");
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => { setShowChannelForm(!showChannelForm) }

    //Check if profile is private and user is not friends
    const isPrivateNotFriend = !profile.isFriend && profile.isPrivate && !isLoggedInUser;
    document.title = profile.username || "Profile";

    return (
        <div className="profile-container">
            <div className="channel-feed">
                {showPostForm ? (
                    <div id="create-post-container">
                        <ContentForm isReply={false} onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                    </div>
                ) : (
                    channelRender && !isPrivateNotFriend ? (
                        <PostChannel canRemove={isLoggedInUser} channelId={channelRender.channel_id} channelName={channelRender.channel_name} isGroup={false} locationId={profile.profileId} />
                    ) : <p className="text36">This feed is private</p>
                )}
            </div>
            <div id="right-aside">
                <div id="profile-summary">
                    <img className="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" /> 
                    {isLoggedInUser && (
                        <Link to={`/settings/${username}`}>
                            <button className="button">Settings</button>
                        </Link>
                    )}
                    <p className="text36">{profile.username}</p>
                    <p className="profile-bio">{profile.bio}</p>
                    <p className="user-count">{profile.followerCount} {profile.followerCount === 1 ? 'follower' : 'followers'}</p>
                    {!isLoggedInUser && !profile.isPrivate && (<FollowerChangeButton userId={loggedInUserId} profileId={profile.profileId} isFollowing={profile.isFollowing} />)}
                    <ManageFriendshipButton userId={loggedInUserId} receiverProfileId={profile.profileId} receiverUserId={profile.userId} isRequestSent={profile.isRequested} isFriend={profile.isFriend} />
                </div>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
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
                            <button className="button" onClick={() => setShowPostForm(false)}>Close</button>
                        </div>
                    ) : (
                        <button className="button" onClick={() => setShowPostForm(true)}>Add Post</button>
                    )
                )}
                {isLoggedInUser && (
                    <div id="add-channel-section">
                        <button className="button" onClick={toggleChannelForm}>
                            {showChannelForm ? 'Close': 'Create channel'}
                        </button>
                        {showChannelForm && (
                            <form id="add-channel-form" onSubmit={AddChannel}>
                                <input className="name-input" type="text" name="channel_name" placeholder="Channel name..." value={newChannelName} onChange={(e) => {
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 30) {
                                        setNewChannelName(input)
                                    } else {
                                        setErrorMessage('Name too long');
                                    }
                                }}/>
                                <input className="dark-button" type="submit" value="Add" disabled={!newChannelName} />
                            </form>                            
                        )}
                    </div>
                )}
                <ChannelList channels={channels} isGroup={false} feedId={profile.profileId} feedName={username} setChannels={setChannels} />
            </div>
        </div>
    );
};

export default Profile;
