import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChatChannel from '../../components/channels/chatChannel';
import MemberChangeButton from '../../components/memberChangeButton';
import PostChannel from '../../components/channels/postChannel';
import PostForm from "../../components/postForm";

function GroupHomeAdmin() {
    const { channel_mode, channel_name, group_name } = useParams();
    const [channels, setChannels] = useState([]);
    const [channelMode, setChannelMode] = useState(channel_mode || 'post');
    const [newChannelName, setNewChannelName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [groupDetails, setGroupDetails] = useState('');
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(false);
    const [members, setMembers] = useState(null);
    const [nestRequests, setNestRequests] = useState(null);
    const [requests, setRequests] = useState([]);
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [showRequests, setShowRequests] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const [subGroups, setSubGroups] = useState([]);

    //Loads group info 
    useEffect(() => {
        const fetchGroupData = () => {
            axios.get(`/api/group/${group_name}`)
                .then(response => {
                    const groupData = response.data;
                    setGroupDetails({
                        isMember: groupData.isMember,
                        groupId: groupData.group_id,
                        groupName: groupData.group_name,
                        description: groupData.description,
                        groupPhoto: groupData.group_photo,
                        memberCount: groupData.member_count,
                        isPrivate: groupData.is_private,
                        isRequestSent: groupData.isRequestSent,
                        userId: groupData.userId
                    });
                })
                .catch(error => {
                    setErrorMessage("Error fetching group details:", error);
                });
            };
        fetchGroupData();
    }, [group_name]);

    //Fetch channels in a group
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

    //Fetch subgroups
    useEffect(() => {
        const fetchSubGroups = async () => {
            try {
                const response = await axios.get(`/api/sub_groups/${groupDetails.groupId}`);
                setSubGroups(response.data);
            } catch (error) {
                console.log("Error fetching sub groups:", error);
            }
        };
        fetchSubGroups();
    }, [groupDetails.groupId]);

    //Adds channel to group
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/add_group_channel', {
                channel_name: newChannelName,
                groupId: groupDetails.groupId,
                isPosts: isPostChannel,
                isChat: isChatChannel
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

    const channelRender = channels.find(
        (c) =>
            c.channel_name === channel_name &&
            (c.is_posts || c.is_posts)
    );

    const deleteChannel = async () => {
        try {
            //Main channels are default, so can't be deleted
            if (channel_name === 'Main') {
                return;
            } else {
                await axios.delete(`/api/delete_group_channel`, { data: {channel_name: channel_name, group_id: groupDetails.groupId} });
            }
        } catch (error) {
            console.error('Error deleting channel:', error);
        }
    };

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

    //Gets requests to join a group if it is a private group
    const getJoinRequests = async () => {
        try {
            const response = await axios.get(`/api/group_requests/${groupDetails.groupId}`);
            setRequests(response.data);
            //const nestResponse = await axios.get(`/api/group_nest_requests/${groupDetails.groupId}`);
            //setNestRequests(nestResponse.data);
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

    //Accepts or rejects join request
    const handleRequestAction = async (action, requestId, senderId) => {
        try {
            if (action === 'accept') {
                await axios.post('/api/accept_join_request', {
                    groupId: groupDetails.groupId, 
                    requestId,
                    senderId,
                });
            } else if (action === 'reject') {
                await axios.delete('/api/reject_group_request', { 
                    data: { requestId: requestId }
                });
            }
            getJoinRequests();
        } catch (error) {
            setErrorMessage('Error handling request:', error);
        }
    };

    //Accepts or rejects join request
    const handleNestRequest = async (action, requestId, senderId) => {
        try {
            if (action === 'accept') {
                await axios.post('/api/accept_nest_request', {
                    groupId: groupDetails.groupId, 
                    requestId,
                    senderId,
                });
            } else if (action === 'reject') {
                await axios.delete('/api/reject_nest_request', { 
                    data: { requestId: requestId }
                });
            }
            getJoinRequests();
        } catch (error) {
            setErrorMessage('Error handling request:', error);
        }
    }; 

    //Uploads content 
    const handlePostSubmit = async (formData) => {
        formData.append('group_id', groupDetails.groupId);
        formData.append('channel_id', channelRender.channel_id);
        try {
            await axios.post('/api/create_group_post', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
            });
            setShowPostForm(false);
        } catch (error) {
            setErrorMessage("Error creating post:", error);
        }
    };

    //Admins can remove members
    const removeMember = async (userId) => {
        try {
            const groupId = groupDetails.groupId;
            axios.post('/api/leave_group', { userId, groupId })
                getGroupMembers();
        } catch (error) {
            setErrorMessage('Error removing member:', error);
        }
    };

    //Allows group to join another group
    const sendGroupJoinRequest = async (receiverName) => {
        try {
            await axios.post('/api/send_nest_request', {
                receiverName: receiverName,
                senderId: groupDetails.groupId,
            });
        } catch (error) {
            setErrorMessage('Error sending join request:', error);
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => {setShowChannelForm((prev) => !prev)};

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
                    <Link to={`/group_settings/${group_name}`}>
                        <button className="button">Settings</button>
                    </Link>
                    <div id="group-members">
                        <p>{groupDetails.memberCount} {groupDetails.memberCount === 1 ? 'member' : 'members'}</p>
                        <button className="button" onClick={getGroupMembers}>
                            {showMembers ? 'Close members' : 'See members'}
                        </button>
                        {groupDetails.isPrivate ? (
                            <button className="button" onClick={() => {getJoinRequests(); setShowRequests(!showRequests)}}>
                                {showRequests ? 'Close join requests' : 'See join requests'}
                            </button>
                        ) : null}
                        <button className="button" onClick={() => {
                            const receiverName = window.prompt('Enter group name');
                            sendGroupJoinRequest(receiverName);
                        }}> Add to group </button>
                        <MemberChangeButton userId={groupDetails.userId} groupId={groupDetails.groupId} isMember={groupDetails.isMember}/>
                    </div>
                    <div id="group-text">
                        <div id="name-section">
                            <div className="view-name">
                                <p className="large-text">{groupDetails.groupName}</p>
                            </div>
                        </div>
                        <div id="description-section">
                            <div className="view-description">
                                <p id="description">{groupDetails.description}</p>
                            </div>
                        </div>
                    </div>
                    <div id="profile-header-photo">
                        <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    </div>
                </header>  
                <div className="channel-feed">
                    {showMembers && (
                        <div>
                            {members.map((member, index) => (
                                <div className="group-member" key={index}>
                                    {member.user.username}
                                    <button className="button" onClick={() => toggleModeratorStatus(member.user.user_id, member.is_mod)}>
                                        {member.is_mod ? 'Remove moderator' : 'Make moderator'}
                                    </button>
                                    <button className="button" onClick={() => removeMember(member.user.user_id)}>Remove member</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {showRequests && (
                        <div>
                            <h2>Join Requests</h2>
                            {requests.length === 0 ? (
                                <p>No pending requests</p>
                            ) : (
                                <div>
                                    <ul>
                                        <p>Users</p>
                                        {requests.map((request) => (
                                            <li key={request.request_id}>
                                                {request.sender.username}
                                                <button className="button" onClick={() => handleRequestAction("accept", request.request_id, request.sender_id)}>
                                                    Accept
                                                </button>
                                                <button className="button" onClick={() => handleRequestAction("reject", request.request_id)}>
                                                    Reject
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <ul>
                                        <p>Groups</p>
                                        {nestRequests.map((request) => (
                                            <li key={request.request_id}>
                                                {request.sender.groupName}
                                                <button className="button" onClick={() => handleNestRequest("accept", request.request_id, request.sender_id)}>
                                                    Accept
                                                </button>
                                                <button className="button" onClick={() => handleNestRequest("reject", request.request_id)}>
                                                    Reject
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {!showMembers && !showRequests && (
                        <>
                            {showPostForm ? (
                                <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                            ) : channelRender ? (
                                channelMode === 'post' ? (
                                    <PostChannel
                                        canRemove={true}
                                        channelId={channelRender.channel_id}
                                        channelName={channelRender.channel_name}
                                        isGroup={true}
                                        locationId={groupDetails.groupId}
                                    />
                                ) : (
                                    <ChatChannel
                                        canRemove={true}
                                        channelId={channelRender.channel_id}
                                        isGroup={true}
                                        locationId={groupDetails.groupId}
                                    />
                                )
                            ) : null}
                        </>
                    )}
                </div>
            </div>  
            <aside id="right-aside">
                <h1>{channel_name}</h1>
                {channelRender && (channelRender.is_posts && channelRender.is_chat) && (
                <div id="channel-toggle">
                    <button className={channelMode === 'post' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('post')}>Posts</button>
                    <button className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('chat')}>Chat</button>
                </div>
                )}
                {showPostForm && channelMode === 'post' && (
                    <div>
                        <button class="button" onClick={() => setShowPostForm(false)}>Close</button>
                    </div>
                )}
                {!showPostForm && channelMode === 'post' && (
                       <button class="button" onClick={() => setShowPostForm(true)}>Create Post</button>
                )}
                <h2>Channels</h2>
                <div id="add-channel-section">
                    <button class="button" onClick={toggleChannelForm}>
                        {showChannelForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showChannelForm && (
                        <form id="add-channel-form" onSubmit={AddChannel}>
                            <input className="channel-input" type="text" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                            <label>
                                <input type="checkbox" checked={isPostChannel} onChange={handlePostClick}/>
                                Post Channel
                            </label>
                            <label>
                                <input type="checkbox" checked={isChatChannel} onChange={handleChatClick}/>
                                Chat Channel
                            </label>
                            <input className="button" type="submit" value="Add" disabled={!newChannelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                            <li key={channel.channelId}>
                                <Link to={`/group/${groupDetails.groupName}/${channel.channel_name}`}>
                                    <div className="channel-link">{channel.channel_name}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                {channel_name !== 'Main' && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button>
                )}
                {subGroups.length === 0 ? (
                    <div></div>
                ) : (
                    <div>
                        <h2>Groups</h2>
                        <ul>
                            {subGroups.map((subGroup, index) => (
                                <li key={index}>
                                    <Link className="group-list-link" to={`/group/${subGroup.SubGroup.group_name}/Main`}>
                                        <img className="small-group-photo" src={`/${subGroup.SubGroup.group_photo}`} alt={subGroup.SubGroup.group_name} />
                                        <p className="group-list-text">{subGroup.SubGroup.group_name}</p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </aside> 
        </div>
    );
}

export default GroupHomeAdmin;
