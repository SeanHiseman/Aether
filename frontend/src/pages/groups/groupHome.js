import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChatChannel from '../../components/channels/chatChannel';
import MemberChangeButton from '../../components/memberChangeButton';
import GroupHomeAdmin from './groupHomeAdmin';
import PostChannel from '../../components/channels/postChannel';
import PostForm from "../../components/postForm";

function GroupHome() {
    const { group_name, channel_name, channel_mode } = useParams();
    const [canRemove, setCanRemove] = useState(false);
    const [channels, setChannels] = useState([]);
    const [channelMode, setChannelMode] = useState(channel_mode);
    const [errorMessage, setErrorMessage] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [groupDetails, setGroupDetails] = useState('');
    const [showPostForm, setShowPostForm] = useState(false);
    document.title = groupDetails.groupName;

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
            } else {
                setChannels([]);
            }
        })
        .catch(error => {
            console.error('Error fetching channels data:', error);
            setChannels([]);
        });
    }, [groupDetails.groupId]);  

    const channelRender = channels.find(
        (c) =>
            c.channel_name === channel_name &&
            (c.is_posts || c.is_posts)
    );

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

    //Checks membership if group is private
    const isNotPrivateMember = !groupDetails.isMember && groupDetails.isPrivate;

    //Load different page if user is admin
    if (isAdmin) {
        return <GroupHomeAdmin />
    }
    else if (isNotPrivateMember) {
        return (
            <div className="group-container">
                <div className="content-feed">
                    <header id="group-header">
                        <div id="group-members">
                            <p>{groupDetails.memberCount} members</p>
                            <MemberChangeButton 
                                userId={groupDetails.userId} 
                                groupId={groupDetails.groupId} 
                                isMember={groupDetails.isMember} 
                                isRequestSent={groupDetails.isRequestSent}
                                isPrivate={groupDetails.isPrivate}
                            />
                        </div>
                        <div id="group-text">
                            <p className="large-text">{groupDetails.groupName}</p>
                            <p id="description" >{groupDetails.description}</p>
                        </div>
                        <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    </header>   
                </div>
            </div>
        )
    } else {
        return (    
            <div className="group-container">  
                <div className="content-feed">
                    <header id="group-header">
                        <div id="group-members">
                            <p>{groupDetails.memberCount} members</p>
                            <MemberChangeButton 
                                userId={groupDetails.userId} 
                                groupId={groupDetails.groupId} 
                                isMember={groupDetails.isMember} 
                                isRequestSent={groupDetails.isRequestSent} 
                                isPrivate={groupDetails.isPrivate}
                            />
                        </div>
                        <div id="group-text">
                            <p className="large-text">{groupDetails.groupName}</p>
                            <p id="description" >{groupDetails.description}</p>
                        </div>
                        <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    </header>
                    <div className="channel-feed">
                        {showPostForm ? (
                            <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                        ) : channelRender ? (
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
                        ) : null}
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
                </aside>
            </div>
        );
    }
}

export default GroupHome;