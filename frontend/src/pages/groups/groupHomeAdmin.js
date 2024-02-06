import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import PostForm from '../../components/postForm';

function GroupHomeAdmin() {
    const { groupId } = useParams();
    const [isAdmin, setIsAdmin] = useState(true);
    const [groupDetails, setGroupDetails] = useState({ groupName: '', description: '', groupPhoto: '', memberCount: 0 });
    const [channels, setChannels] = useState(groupId.channels || []);
    useEffect(() => {
        fetch(`/api/group/${groupId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                setIsAdmin(data.isAdmin);
                setGroupDetails({
                    groupName: data.groupName,
                    description: data.description,
                    groupPhoto: data.groupPhoto,
                    memberCount: data.memberCount
                });
            }).catch(error => {
                console.error('Fetch error:', error);
            })
    }, [groupId]);
    
    //Uploads content to group
    const handleUploadSubmit = async (event) => {
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

    //Adds channel to group
    const handleAddChannelSubmit = async (event) => {
        event.preventDefault();
        const channelName = event.target.elements.channel_name.value;
        try {
            const response = await axios.post('/api/add_channel', {
                channel_name: channelName,
                groupId: groupId.group_id
            });
            if (response.data && response.status === 200) {
                setChannels([...channels, response.data]);
            }
        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
        }
    };

    return (
        <div>
            <header className="group-header">
                <img className="group-photo" src={groupDetails.groupPhoto} alt={groupDetails.groupName} />
                <h1>{groupDetails.groupName}</h1>
                <p>{groupDetails.memberCount} members</p>
                <p>{groupDetails.description}</p>
                <PostForm />
            </header>
            <main>
                <div className="channels">
                    <h2>Channels</h2>
                    {/*<ul>
                        {groupId.channels.map((channel, index) => (
                            <li key={index}>{channel}</li>
                        ))}
                        </ul>*/}
                </div>
                <div id="add-channel-section">
                    <p>Add channel</p>
                    <form id="add-channel-form" action="/add_channel" method="post" onSubmit={handleAddChannelSubmit}>
                        <input type="text" name="Name" placeholder="Channel name" />
                        <input id="create-group-button" type="submit" value="Add" />
                    </form>
                </div>
            </main>
        </div>
    );
}

export default GroupHomeAdmin;
