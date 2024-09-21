import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChannelList from '../../components/channels/channelList';
import ChannelName from '../../components/channels/channelName';
import ChatChannel from '../../components/channels/chatChannel';
import ContentForm from "../../components/contentForm";
import MemberChangeButton from '../../components/memberChangeButton';
import PostChannel from '../../components/channels/postChannel';
import { useQuery, useQueryClient } from "@tanstack/react-query";

const GroupHome = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { group_name, channel_name } = useParams();
    const [channelMode, setChannelMode] = useState('post');
    const [channels, setChannels] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [newChannelName, setNewChannelName] = useState('');
    const [showForm, setShowForm] = useState({ channel: false, post: false });
    const [subFeeds, setSubFeeds] = useState([]);
    const [groupState, setGroupState] = useState({
        isAdmin: false,
        isMod: false,
        canRemove: false,
        isChatChannel: false,
        isPostChannel: false,
        groupDetails: '',
    });

    const { data: groupData, error, isLoading } = useQuery(['groupData', group_name], async () => {
        const response = await axios.get(`/api/group/${group_name}`);
        return response.data; 
    }, {
        onSuccess: (data) => {
            setGroupState((prevState) => ({
                ...prevState,
                isAdmin: data.isAdmin,
                isMod: data.isMod,
                groupDetails: data,
                canRemove: data.isAdmin || data.isMod,
            }));
        },
    });

    //Gets sub feeds
    const { data: subFeedData, isError: subFeedError } = useQuery(
        ['subFeeds', groupState.groupDetails.groupId],
        async () => {
            const response = await axios.get(`/api/sub_feeds/${groupState.groupDetails.groupId}`);
            return response.data;
        }, {
            enabled: !!groupState.groupDetails.groupId,
            onSuccess: (data) => setSubFeeds(data),
            onError: () => setErrorMessage('Error getting feeds'),
        }
    )

    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setErrorMessage("Channel needs a name");
            } else {
                const response = await axios.post('/api/add_group_channel', {
                    channel_name: newChannelName,
                    groupId: groupState.groupDetails.groupId,
                    isPosts: groupState.isPostChannel,
                    isChat: groupState.isChatChannel
                });
                if (response.data && response.status === 201) {
                    setChannels([...channels, response.data]);
                    setErrorMessage('');
                    setNewChannelName('');
                    setShowForm((prev) => ({ ...prev, channel: false }));
                    navigate(`/g/${group_name}/${newChannelName}`);
                } else {
                    setErrorMessage('Failed to add channel');
                }
            }
        } catch (error) {
            setErrorMessage('Failed to add channel');
        }
    };

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
                await axios.delete(`/api/delete_group_channel`, { data: {channel_name: channel_name, group_id: groupDetails.groupId} });
                setChannels(prevChannels => prevChannels.filter(channel => channel.channel_name !== channel_name));
                navigate(`/g/${group_name}/Main`);
            }
        } catch (error) {
            setErrorMessage('Error deleting channel');
        }
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

    //Uploads content 
    const handlePostSubmit = async (formData) => {
        formData.append('group_id', groupState.groupDetails.groupId);
        formData.append('channel_id', channelRender.channel_id);
        try {
            await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShowForm((prev) => ({ ...prev, post: false }));
        } catch (error) {
            setErrorMessage("Error creating post");
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => { setShowChannelForm((prev) => !prev) };

    //Checks membership if group is private
    const isNotPrivateMember = !groupState.groupDetails.isMember && groupState.groupDetails.isPrivate;

    document.title = groupDetails.groupName;
    if (isLoading) return <div>Loading feed...</div>; 
    if (error) return <div>Error loading feed</div>; 
    return (    
        <div className="group-container">  
            <div className="channel-feed">
                {showPostForm ? (
                    <div id="create-post-container">
                        <ContentForm isReply={false} onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                    </div>
                ) : channelRender && !isNotPrivateMember ? (
                        channelRender.is_posts && (channelMode === 'post' || !channelRender.is_chat) ? (
                        <PostChannel
                            canRemove={groupState.canRemove}
                            channelId={channelRender.channel_id}
                            channelName={channelRender.channel_name}
                            isGroup={true}
                            locationId={groupState.groupDetails.groupId}
                        />
                    ) : (
                        <ChatChannel
                            canRemove={groupState.canRemove}
                            channelId={channelRender.channel_id}
                            isGroup={true}
                            locationId={groupState.groupDetails.groupId}
                        />
                    )
                ) : (
                    <p className="text36">This feed is private</p>
                )}
            </div>    
            <aside id="right-aside">
                <div id="profile-summary">
                    <img className="large-group-photo" src={`/${groupState.groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    {isAdmin && (
                        <Link to={`/group_settings/${group_name}`}>
                            <button className="button">Settings</button>
                        </Link>
                    )}
                    <p className="text36">{groupState.groupDetails.groupName}</p>
                    <p className="description" >{groupState.groupDetails.description}</p>
                    <p className="user-count">{groupState.groupDetails.memberCount} {groupState.groupDetails.memberCount === 1 ? 'follower' : 'followers'}</p>
                    <MemberChangeButton 
                        userId={groupState.groupDetails.userId} 
                        groupId={groupState.groupDetails.groupId} 
                        isMember={groupState.groupDetails.isMember} 
                        isRequestSent={groupState.groupDetails.isRequestSent} 
                        isPrivate={groupState.groupDetails.isPrivate}
                    />
                </div>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                {channelRender && (
                    isAdmin ? (
                    <ChannelName channelId={channelRender.channel_id} channelName={channel_name} channelType={'group'} locationName={group_name} channelUpdate={channelUpdate}/>
                    ) : (
                        <p className="text36">{channel_name}</p>
                    ) 
                )}
                {showForm && channelMode === 'post' && (
                    <div>
                        <button className="button" onClick={() => setShowPostForm(false)}>Close</button>
                    </div>
                )}
                {!showForm && channelMode === 'post' && (
                    <button className="button" onClick={() => setShowPostForm(true)}>Add Post</button>
                )}
                {channelRender && channelRender.is_posts && channelRender.is_chat && (
                    <div className="option-toggle">
                        <button className={channelMode === 'post' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('post')}>Posts</button>
                        <button className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('chat')}>Chat</button>
                    </div>
                )}
                {isAdmin && (
                    <div id="add-channel-section">
                        <button className="button" onClick={toggleChannelForm}>
                            {showChannelForm ? 'Close': 'Create channel'}
                        </button>
                        {showChannelForm && (
                            <form id="add-channel-form" onSubmit={AddChannel}>
                                <input className="name-input" type="text" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                                <label>
                                    <input type="checkbox" checked={groupState.isPostChannel} onChange={handlePostClick}/>
                                    Post Channel
                                </label>
                                <label>
                                    <input type="checkbox" checked={groupState.isChatChannel} onChange={handleChatClick}/>
                                    Chat Channel
                                </label>
                                <input className="dark-button" type="submit" value="Add"/>
                            </form>                            
                        )}
                    </div>
                )}
                <ChannelList channels={channels} feedId={groupState.groupDetails.groupId} feedName={group_name} isGroup={true} setChannels={setChannels}/>
                {groupState.isAdmin && channel_name !== 'Main' && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button> 
                )}
                {subFeeds.length > 0 && (
                    <div>
                        <ul>
                            {subFeeds.map((subFeed, index) => (
                                <li className="feed-list-item g" key={index}>
                                    <Link className="feed-list-link" to={`/g/${subFeed.SubFeed.group_name}/Main`}>
                                        <img className="small-feed-photo" src={`/${subFeed.SubFeed.group_photo}`} alt={subGroup.SubGroup.group_name} />
                                        <p className="feed-list-text">{subFeed.SubFeed.group_name}</p>
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

export default GroupHome;