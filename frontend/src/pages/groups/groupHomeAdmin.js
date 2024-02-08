import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import PostForm from '../../components/postForm';

function GroupHomeAdmin() {
    const { group_name } = useParams();
    const [isAdmin, setIsAdmin] = useState(true);
    const [channels, setChannels] = useState(group_name.channels || []);
    const [channelName, setChannelName] = useState('');
    const [groupDetails, setGroupDetails] = useState({ groupName: group_name, description: '', groupPhoto: '', memberCount: 0 });
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
                    groupName: data.groupName,
                    description: data.description,
                    groupPhoto: data.groupPhoto,
                    memberCount: data.memberCount
                });
            }).catch(error => {
                console.error('Fetch error:', error);
            })
    }, [group_name]);
    document.title = groupDetails.groupName;
    //Uploads content to group
    const UploadSubmit = async (event) => {
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
    const AddChannel = async (event) => {
        event.preventDefault();
        const channelName = event.target.elements.channel_name.value;
        try {
            const response = await axios.post('/api/add_group_channel', {
                channel_name: channelName,
                groupId: group_name.group_id
            });
            if (response.data && response.status === 200) {
                setChannels([...channels, response.data]);
            }
        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    return (
        <div id="group-container">           
            <header id="group-header">
                <img id="large-group-photo" src={groupDetails.groupPhoto} alt={groupDetails.groupName} />
                <h1>{groupDetails.groupName}</h1>
                <p>{groupDetails.memberCount} members</p>
                <p>{groupDetails.description}</p>
                <PostForm />
            </header>
            <aside id="right-aside">
                <h2>Channels</h2>
                {/*<ul>
                    {groupId.channels.map((channel, index) => (
                        <li key={index}>{channel}</li>
                    ))}
                    </ul>*/}
                <div id="add-channel-section">
                    <button class="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create new Channel'}
                    </button>
                    {showForm && (
                        <form id="add-channel-form" action="/add_group_channel" method="post" onSubmit={AddChannel}>
                            <input type="text" name="Name" placeholder="Channel name" value={channelName} onChange={(e) => setChannelName(e.target.value)}/>
                            <input className="button" type="submit" value="Add" disabled={!channelName}/>
                        </form>                            
                    )}
                </div>
            </aside> 
        </div>
    );
}

export default GroupHomeAdmin;
