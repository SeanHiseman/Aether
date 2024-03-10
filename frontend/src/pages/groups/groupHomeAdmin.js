import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import ChannelButton from '../../components/channelButton';
import ChatChannel from '../general/chatChannel';
import MemberChangeButton from '../../components/memberChangeButton';
import PostChannel from '../general/postChannel';

function GroupHomeAdmin() {
    const { group_name, channel_name } = useParams();
    const [channels, setChannels] = useState([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [groupDetails, setGroupDetails] = useState({ groupName: group_name, description: '', groupPhoto: '', memberCount: 0 });
    const [isAdmin, setIsAdmin] = useState(true);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [members, setMembers] = useState(null);
    const [showMembers, setShowMembers] = useState(false);
    const [newDescription, setDescription] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setName] = useState('');
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        fetch(`/api/group/${group_name}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                setIsAdmin(data.isAdmin);
                setGroupDetails({
                    isMember: true, //Must be member to be admin
                    groupId: data.groupId,
                    groupName: data.groupName,
                    description: data.description,
                    groupPhoto: data.groupPhoto,
                    memberCount: data.memberCount,
                    userId: data.userId
                });
            }).catch(error => {
                console.error('Fetch error:', error);
            })
    }, [group_name]);

    //Fetch channels in user profile
    useEffect(() => {
        axios.get(`/api/get_group_channels/${groupDetails.groupId}`)
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
    }, [groupDetails.groupId]);  

    //Set name in text area to current description
    useEffect(() => {
        if (isEditingName) {
            setName(groupDetails.groupName);
        }
    }, [isEditingName, groupDetails.groupName]);

    //Set description in text area to current description
    useEffect(() => {
        if (isEditingDescription) {
            setDescription(groupDetails.description);
        }
    }, [isEditingDescription, groupDetails.description]);

    //Adds channel to group
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/add_group_channel', {
                channel_name: newChannelName,
                groupId: groupDetails.groupId,
                isPosts: isPostChannel
            });
            if (response.data && response.status === 201) {
                setChannels([...channels, response.data]);
                setNewChannelName('');
                setErrorMessage('');
            } else {
                setErrorMessage('Failed to add channel.');
            }
        } catch (error) {
            setErrorMessage(error.response ? error.response.data.error : 'Failed to add channel.');
        }
    };

    const ChangeGroupPhoto = (e) => {
        e.preventDefault();
        const fileInput = e.target.elements.new_group_photo;
        if (!fileInput.files[0]) {
            setErrorMessage('Please upload an image');
            return;
        }
        const formData = new FormData();
        formData.append('new_group_photo', fileInput.files[0]);
        axios.post(`/api/update_group_photo/${groupDetails.groupId}`, formData)
            .then(response => {
                //document.getElementById('large-group-photo').src = response.data.newPhotoPath;
                setErrorMessage('');
                setIsPhotoFormVisible(false);
            }).catch(error => {
                setErrorMessage('Error updating photo', error.response ? error.response.data : error);
            });
    }
    
    const channelRender = channels.find(c => c.channel_name === channel_name);
    
    const getGroupMembers = async () => {
        if (!showMembers) {
            try {
                const response = await axios.get('/api/get_group_members', {
                    params: { group_id: groupDetails.groupId }
                });
                setMembers(response.data);
            } catch (error) {
                console.error('Error fetching group members:', error);
            }
        }
        setShowMembers(!showMembers);
    };

    //Set channels to contain either posts or chats
    const handleChatClick = () => setIsPostChannel(false);
    const handlePostClick = () => setIsPostChannel(true);

    //Changes group description
    const handleUpdateDescription = async () => {
        try {
            await axios.post('/api/change_description', {
                description: newDescription,
                groupId: groupDetails.groupId
            });
            setGroupDetails({ ...groupDetails, description: newDescription });
            setIsEditingDescription(false);
        }
        catch (error) {
            setErrorMessage(`Error changing description: ${error}`);
        }
    }; 

    //Changes group name
    const handleUpdateName = async () => {
        try {
            await axios.post('/api/change_group_name', {
                groupName: newName,
                groupId: groupDetails.groupId
            });
            setGroupDetails({ ...groupDetails, groupName: newName });
            setIsEditingName(false);
        }
        catch (error) {
            setErrorMessage(`Error changing name: ${error}`);
        }
    }; 

    //Toggles display of create channel form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    //Allows adding/remvoing of moderators
    const toggleModeratorStatus = async (userId, isMod) => {
        try {
            const response = await axios.post('/api/toggle_moderator', {
                groupId: groupDetails.groupId,
                userId: userId,
                isMod: !isMod, //Opposite to current state
            });
            if (response.status === 200) {
                getGroupMembers();
            }
        } catch (error) {
            console.error("Error toggling moderator status:", error);
        }
    };

    document.title = groupDetails.groupName;
    return (
        <div className="group-container">  
            <div className="content-feed">
                <header id="group-header">
                    <div id="group-members">
                        <p>{groupDetails.memberCount} members</p>
                        <button className="button" onClick={getGroupMembers}>
                            {showMembers ? 'Close members' : 'See members'}
                        </button>
                        <MemberChangeButton userId={groupDetails.userId} groupId={groupDetails.groupId} isMember={groupDetails.isMember}/>
                    </div>
                    <div id="group-text">
                        <div id="name-section">
                            {isEditingName ? (
                                <div className="change-name">
                                    <button className='button' onClick={() => setIsEditingName(false)}>Close</button>
                                    <textarea className="change-name-area" value={newName} onChange={(e) => {
                                        const input = e.target.value;
                                        const inputLength = input.length;
                                        if (inputLength <= 100) {
                                            setName(input)
                                        } else {
                                            setErrorMessage('Name cannot exceed 100 characters.');
                                        }
                                    }}
                                    />
                                    <button className="button" onClick={() => {setIsEditingName(false); handleUpdateName();}}>Save</button>
                                </div>
                            ) : (
                                <div className="view-name">
                                    <p className="large-text">{groupDetails.groupName}</p>
                                    <button className="button" onClick={() => setIsEditingName(true)}>Edit</button>
                                </div>
                            )}
                        </div>
                        <div id="description-section">
                            {isEditingDescription ? (
                                <div className="change-description">
                                    <button className='button' onClick={() => setIsEditingDescription(false)}>Close</button>
                                    <textarea className="change-text-area" value={newDescription} onChange={(e) => {
                                        const input = e.target.value;
                                        const inputLength = input.length;
                                        if (inputLength <= 1000) {
                                            setDescription(input)
                                        } else {
                                            setErrorMessage('Description cannot exceed 1000 characters.');
                                        }
                                    }}
                                    />
                                    <button className="button" onClick={() => {setIsEditingDescription(false); handleUpdateDescription();}}>Save</button>
                                </div>
                            ) : (
                                <div className="view-description">
                                    <p id="description">{groupDetails.description}</p>
                                    <button className="button" onClick={() => setIsEditingDescription(true)}>Edit</button>
                                </div>
                            )}
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </div>
                    </div>
                    <div id="profile-header-photo">
                        <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                        <button className="button" onClick={() => setIsPhotoFormVisible(!isPhotoFormVisible)}>
                            {isPhotoFormVisible ? 'Close' : 'Change Group photo'}
                        </button>
                        {isPhotoFormVisible && (
                            <form id="change-group-photo" action="/api/update_group_photo" method="post" enctype="multipart/form-data" onSubmit={ChangeGroupPhoto}>
                                <label htmlFor="new_group_photo">Change Group photo:</label>
                                <input type="file" id="new_group_photo" name="new_group_photo" accept="image/*" />
                                {errorMessage && <div className="error-message">{errorMessage}</div>}
                                <input className="button" type="submit" value="Update" />
                            </form>
                        )}
                    </div>
                </header>  
                <div className="channel-feed">
                    {showMembers ? (
                        <div>
                            {members.map((member, index) => (
                                <div class="group-member" key={index}>
                                    {member.user.username}
                                    <button className="button" onClick={() => toggleModeratorStatus(member.user.user_id, member.is_mod)}>
                                        {member.is_mod ? 'Remove moderator': 'Make moderator'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        channelRender ? (
                            channelRender.is_posts ? (
                                <PostChannel channel={channelRender} channelId={channelRender.channel_id} channelName={channelRender.channel_name} isGroup={true} locationId={groupDetails.groupId}/>
                                    ) : (
                                <ChatChannel channel={channelRender} channelId={channelRender.channel_id} channelName={channelRender.channel_name} isGroup={true} locationId={groupDetails.groupId}/>
                            )
                        ) : null
                    )}
                </div>
            </div>     
            <aside id="right-aside">
                <h2>Channels</h2>
                <div id="add-channel-section">
                    <button class="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showForm && (
                        <form id="add-channel-form" onSubmit={AddChannel}>
                            <input className="channel-input" type="text" name="channel_name" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                            <p>Channel type:</p>
                            <div id="post-chat-section">
                                <button type="button" class="button" onClick={handlePostClick}>Post</button>
                                <button type="button" class="button" onClick={handleChatClick}>Chat</button>
                            </div>
                            <input className="button" type="submit" value="Add" disabled={!newChannelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                            <li key={channel.channelId}>
                                {<ChannelButton is_posts={channel.is_posts} channel_name={channel.channel_name} name={groupDetails.groupName} is_group={true} />}
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside> 
        </div>
    );
}

export default GroupHomeAdmin;
