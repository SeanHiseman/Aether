import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import ChannelButton from '../../components/channelButton';
import ChatChannel from '../general/chatChannel';
import MemberChangeButton from '../../components/memberChangeButton';
import GroupHomeAdmin from './groupHomeAdmin';
import PostChannel from '../general/postChannel';

function GroupHome() {
    const { group_name, channel_name } = useParams();
    const [channels, setChannels] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [groupDetails, setGroupDetails] = useState({ groupName: '', description: '', groupPhoto: '', memberCount: 0 });

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
                    isMember: data.isMember,
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

    const channelRender = channels.find(c => c.channel_name === channel_name);

    //Load different page if user is admin
    if (isAdmin) {
        return <GroupHomeAdmin />
    } else {
        document.title = groupDetails.groupName;
        return (    
            <div className="group-container">  
                <div className="content-feed">
                    <header id="group-header">
                        <div id="group-members">
                            <p>{groupDetails.memberCount} members</p>
                            <MemberChangeButton userId={groupDetails.userId} groupId={groupDetails.groupId} isMember={groupDetails.isMember}/>
                        </div>
                        <div id="group-text">
                            <p className="large-text">{groupDetails.groupName}</p>
                            <p id="description" >{groupDetails.description}</p>
                        </div>
                        <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    </header>
                    <div className="channel-feed">
                        {channelRender ? (
                            channelRender.is_posts ? (
                                <PostChannel channel={channelRender} channelId={channelRender.channel_id} channelName={channelRender.channel_name} isGroup={true} locationId={groupDetails.groupId}/>
                                    ) : (
                                <ChatChannel channel={channelRender} channelId={channelRender.channel_id} channelName={channelRender.channel_name} isGroup={true} locationId={groupDetails.groupId}/>
                            )
                        ) : null}
                    </div>
                </div>         
                <aside id="right-aside">
                    <h2>Channels</h2>
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
}

export default GroupHome;
