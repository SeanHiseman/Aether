import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PostChannel from '../../components/channels/postChannel';
import PostForm from '../../components/postForm';

//Loads the profile page of the logged in user
const PersonalProfile = () => {
    const { username, channel_name } = useParams();
    const [channels, setChannels] = useState([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [friendRequests, setFriendRequests] = useState('');
    const [profile, setProfile] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const navigate = useNavigate();

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
            })
    }, [username, navigate]);

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

    //Adds channel to profile
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/add_profile_channel', {
                channel_name: newChannelName,
                profileId: profile.profileId,
                isPosts: true
            });
            if (response.data && response.status === 201) {
                setChannels([...channels, response.data]);
                setNewChannelName('');
                setErrorMessage('');
            } else {
                setErrorMessage('Failed to add channel. Please try again.');
            }
        } catch (error) {
            setErrorMessage(error.response ? error.response.data.error : 'Failed to add channel. Please try again.');
        }
    };  
    
    const channelRender = channels.find(c => c.channel_name === channel_name);

    const deleteChannel = async () => {
        try {
            //Main channels are default, so can't be deleted
            if (channel_name === 'Main') {
                return;
            } else {
                await axios.delete(`/api/delete_profile_channel`, { data: {channel_name: channel_name, profile_id: profile.profileId} });
            }
        } catch (error) {
            console.error('Error deleting channel:', error);
        }
    };

    const getFriendRequests = async () => {
        try {
            const response = await axios.get('/api/get_friend_requests');
            setFriendRequests(response.data);
        } catch (error) {
            setErrorMessage('Error fetching friend requests:', error);
        } finally {
            setShowFriendRequests(true);
        }
    };

    const handleFriendRequest = async (request, result) => {
        try {
            if (result === 'Accept') {
                await axios.post('/api/accept_friend_request', { request });
                setFriendRequests(prevRequests => prevRequests.filter(req => req.request_id !== request.request_id));
            } else if (result === 'Reject') {
                await axios.delete('/api/reject_friend_request', { data: { request } });
                setFriendRequests(prevRequests => prevRequests.filter(req => req.request_id !== request.request_id));
            }
        } catch (error) {
            setErrorMessage("Error handling request:", error);
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

    document.title = profile.username || "Profile";
    return (
        <div className="profile-container">
            <div className="content-feed">
                <header id="profile-header">
                    <div id="profile-options">
                        <Link to={`/settings/${username}`}>
                            <button className="button">Settings</button>
                        </Link>
                        <button className="button" onClick={getFriendRequests}>
                            {showFriendRequests ? 'Close requests' : 'See friend requests'}
                        </button>
                        <p>{profile.followerCount} {profile.followerCount === 1 ? 'follower' : 'followers'}</p>  
                    </div>
                    <div id="viewed-profile-info">
                        <div id="name-section">
                            <div className="view-name">
                                <p className="large-text">{profile.username}</p>
                            </div>
                        </div>
                        <div id="bio-section">
                            <div className="view-bio">
                                <p id="profile-bio">{profile.bio}</p>
                            </div>
                        </div>
                    </div>
                    <div id="profile-header-photo">
                        <img className="large-profile-photo" src={`/${profile.profilePhoto}`} alt="Profile" />
                    </div>
                </header>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
                <div className="channel-feed">
                    {showFriendRequests ? (
                        <div className="channel-content">
                            <h2>Friend Requests</h2>
                            {friendRequests.length === 0 ? (
                                <p>No pending requests</p>
                            ) : (
                                <ul className="content-list">
                                    {friendRequests.map((request, index) => (
                                        <li key={index}>
                                            <div className="result-widget">
                                                <Link className="friend-link" to={`/profile/${request.sender.username}`}>
                                                    <img className="large-profile-photo" src={`/${request.sender.profile.profile_photo}`} alt="Profile" />
                                                    <p className="large-text profile-name">{request.sender.username}</p>
                                                </Link>
                                                <button className="button" onClick={() => handleFriendRequest(request, 'Accept')}>
                                                    Accept friend request
                                                </button>
                                                <button className="button" onClick={() => handleFriendRequest(request, 'Reject')}>
                                                    Reject friend request
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>                                                                                                                    
                    ) : (
                        showPostForm ? (
                            <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                        ) : ( channelRender ? (
                            <PostChannel 
                                channelId={channelRender.channel_id} 
                                channelName={channelRender.channel_name} 
                                isGroup={false} 
                                locationId={profile.profileId}/>
                        ) : null
                        )
                    )}
                </div>
            </div>
            <div id="right-aside">
                <h1>{channel_name}</h1>
                {showPostForm && (
                    <div>
                        <button class="button" onClick={() => setShowPostForm(false)}>Close</button>
                    </div>
                )}
                {!showPostForm && (
                       <button class="button" onClick={() => setShowPostForm(true)}>Create Post</button>
                )}
                <h2>Channels</h2>
                <div id="add-channel-section">
                    <button class="button" onClick={toggleChannelForm}>
                        {showChannelForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showChannelForm && (
                        <form id="add-channel-form" onSubmit={AddChannel}>
                            <input className="channel-input" type="text" name="channel_name" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                            <input className="button" type="submit" value="Add" disabled={!newChannelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
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
                {channel_name !== 'Main' && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button>
                )}
            </div>
        </div>
    );
}

export default PersonalProfile;
