import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import MemberChangeButton from '../../components/memberChangeButton';
import GroupHomeAdmin from './groupHomeAdmin';
import PostForm from '../../components/postForm';

function GroupHome() {
    const { group_name } = useParams();
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
                console.error('Expected an array for channels, received: ', response.data)
                setChannels([]);
            }
        })
        .catch(error => {
            console.error('Error fetching channels data:', error);
            setChannels([]);
        });
    }, [groupDetails.groupId]);  

    //Uploads content to group
    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        try {
            const response = await axios.post('/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

    //Load different page if user is admin
    if (isAdmin) {
        return <GroupHomeAdmin />
    } else {
        document.title = groupDetails.groupName;
        return (    
            <div id="group-container">           
                <header id="group-header">
                    <PostForm />
                    <div id="group-members">
                        <p>{groupDetails.memberCount} members</p>
                        <MemberChangeButton userId={groupDetails.userId} groupId={groupDetails.groupId} isMember={groupDetails.isMember}/>
                    </div>
                    <div id="group-text">
                        <h1>{groupDetails.groupName}</h1>
                        <p>{groupDetails.description}</p>
                    </div>
                    <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                </header>
                <aside id="right-aside">
                    <h2>Channels</h2>
                    <nav id="channel-list">
                    <ul>
                        {channels.map(channel => (
                        <li key={channel.channelId}>
                            <p className="channel-list-text">{channel.channel_name}</p>
                            {/*<Link className="channel-list-link" to={`/group_channels/${channel.channelName}`}>
                                <p className="channel-list-text">{channel.channelName}</p>
                            </Link>*/}
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
