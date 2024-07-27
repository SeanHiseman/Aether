import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChatChannel from '../../components/channels/chatChannel';
import MemberChangeButton from '../../components/memberChangeButton';
import PostChannel from '../../components/channels/postChannel';
import PostForm from "../../components/postForm";

function GroupHome() {
    const { group_name, channel_name } = useParams();
    const [canRemove, setCanRemove] = useState(false);
    const [channels, setChannels] = useState([]);
    const [channelMode, setChannelMode] = useState('post');
    const [errorMessage, setErrorMessage] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [groupDetails, setGroupDetails] = useState('');
    const navigate = useNavigate();
    const [newChannelName, setNewChannelName] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const [subGroups, setSubGroups] = useState([]);

    //Loads group info 
    useEffect(() => {
        const fetchGroupData = () => {
            axios.get(`/api/group/${group_name}`)
                .then(response => {
                    const groupData = response.data;
                    setIsAdmin(groupData.isAdmin);
                    setIsModerator(groupData.isModerator);
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

    //Moderators can remove content
    if (isModerator) {
        setCanRemove(true);
    };

    //Fetch channels in a group
    useEffect(() => {
        axios.get(`/api/get_group_channels/${groupDetails.groupId}`)
        .then(response => {
            if (Array.isArray(response.data)) {
                setChannels(response.data);
                const currentChannel = response.data.find(c => c.channel_name === channel_name);
                if (currentChannel) {
                    if (currentChannel.is_chat && !currentChannel.is_posts) {
                        setChannelMode('chat');
                    } else {
                        setChannelMode('post');
                    }
                }
            } else {
                setChannels([]);
            }
        })
        .catch(error => {
            console.error('Error fetching channels data:', error);
            setChannels([]);
        });
    }, [groupDetails.groupId, channel_name]);  

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
            if (newChannelName.length === 0) {
                setErrorMessage("Channel needs a name");
            } else {
                const response = await axios.post('/api/add_group_channel', {
                    channel_name: newChannelName,
                    groupId: groupDetails.groupId,
                    isPosts: isPostChannel,
                    isChat: isChatChannel
                });
                if (response.data && response.status === 201) {
                    setChannels([...channels, response.data]);
                    setErrorMessage('');
                    setNewChannelName('');
                    setShowChannelForm(false);
                    navigate(`/group/${group_name}/${newChannelName}`);
                } else {
                    setErrorMessage('Failed to add channel.');
                }
            }
        } catch (error) {
            setErrorMessage(error.response ? error.response.data.error : 'Failed to add channel.');
        }
    };

    const channelRender = channels.find(c => c.channel_name === channel_name);

    const deleteChannel = async () => {
        try {
            //Main channels are default, so can't be deleted
            if (channel_name === 'Main') {
                return;
            } else {
                await axios.delete(`/api/delete_group_channel`, { data: {channel_name: channel_name, group_id: groupDetails.groupId} });
                setChannels(prevChannels => prevChannels.filter(channel => channel.channel_name !== channel_name));
                navigate(`/group/${group_name}/Main`);
            }
        } catch (error) {
            console.error('Error deleting channel:', error);
        }
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

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
            setErrorMessage("Error creating post.");
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => {setShowChannelForm((prev) => !prev)};

    //Checks membership if group is private
    const isNotPrivateMember = !groupDetails.isMember && groupDetails.isPrivate;

    document.title = groupDetails.groupName;
    return (    
        <div className="group-container">  
            <div className="content-feed">
                <div className="channel-feed">
                    {showPostForm ? (
                        <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                    ) : channelRender && !isNotPrivateMember ? (
                        channelRender.is_posts && channelRender.is_chat ? (
                            channelMode === 'post' ? (
                                <PostChannel
                                    canRemove={canRemove}
                                    channelId={channelRender.channel_id}
                                    channelName={channelRender.channel_name}
                                    isGroup={true}
                                    locationId={groupDetails.groupId}
                                />
                            ) : (
                                <ChatChannel
                                    canRemove={canRemove}
                                    channelId={channelRender.channel_id}
                                    isGroup={true}
                                    locationId={groupDetails.groupId}
                                />
                            )
                        ) : channelRender.is_posts ? (
                            <PostChannel
                                canRemove={canRemove}
                                channelId={channelRender.channel_id}
                                channelName={channelRender.channel_name}
                                isGroup={true}
                                locationId={groupDetails.groupId}
                            />
                        ) : (
                            <ChatChannel
                                canRemove={canRemove}
                                channelId={channelRender.channel_id}
                                isGroup={true}
                                locationId={groupDetails.groupId}
                            />
                        )
                    ) : <p className="large-text">This group is private</p>}
                </div>
            </div>         
            <aside id="right-aside">
                <div id="profile-summary">
                    {isAdmin && (
                        <Link to={`/group_settings/${group_name}`}>
                            <button className="button">Settings</button>
                        </Link>
                    )}
                    <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    <p className="large-text">{groupDetails.groupName}</p>
                    <p id="description" >{groupDetails.description}</p>
                    <p id="user-count">{groupDetails.memberCount} members</p>
                    <MemberChangeButton 
                        userId={groupDetails.userId} 
                        groupId={groupDetails.groupId} 
                        isMember={groupDetails.isMember} 
                        isRequestSent={groupDetails.isRequestSent} 
                        isPrivate={groupDetails.isPrivate}
                    />
                </div>
                <h1>{channel_name}</h1>
                {showPostForm && channelMode === 'post' && (
                    <div>
                        <button class="button" onClick={() => setShowPostForm(false)}>Close</button>
                    </div>
                )}
                {!showPostForm && channelMode === 'post' && (
                    <button class="button" onClick={() => setShowPostForm(true)}>Create Post</button>
                )}
                {channelRender && channelRender.is_posts && channelRender.is_chat && (
                    <div id="channel-toggle">
                        <button className={channelMode === 'post' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('post')}>Posts</button>
                        <button className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('chat')}>Chat</button>
                    </div>
                )}
                {isAdmin && (
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
                                <input className="button" type="submit" value="Add"/>
                                {errorMessage && <div className="error-message">{errorMessage}</div>}
                            </form>                            
                        )}
                    </div>
                )}
                <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                            <li key={channel.channelId} className="channel-item">
                                <Link to={`/group/${groupDetails.groupName}/${channel.channel_name}`}>
                                    <div className="channel-link">{channel.channel_name}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                {isAdmin && channel_name !== 'Main' && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button> 
                )}
                {isAdmin && (
                    subGroups.length === 0 ? (
                        <div></div>
                    ) : (
                        <div>
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
                    )
                )}
            </aside>
        </div>
    );
}


export default GroupHome;