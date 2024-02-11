import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import ChangeProfilePhoto from '../../components/changeProfilePhoto';
import PostForm from '../../components/postForm';

function GroupHomeAdmin() {
    const { group_name } = useParams();
    const [channels, setChannels] = useState(group_name.channels || []);
    const [channelName, setChannelName] = useState('');
    const [errorMessage, setErrorMessage] =useState('');
    const [groupDetails, setGroupDetails] = useState({ groupName: group_name, description: '', groupPhoto: '', memberCount: 0 });
    const [isAdmin, setIsAdmin] = useState(true);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
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
                    groupId: data.groupId,
                    groupName: data.groupName,
                    description: data.description,
                    groupPhoto: data.groupPhoto,
                    memberCount: data.memberCount
                });
            }).catch(error => {
                console.error('Fetch error:', error);
            })
    }, [group_name]);

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
                groupId: groupDetails.groupId
            });
            if (response.data && response.status === 201) {
                setChannels([...channels, response.data]);
                setChannelName('');
                setErrorMessage('');
            } else {
                setErrorMessage('Failed to add channel. Please try again.');
            }
        } catch (error) {
            setErrorMessage(error.response ? error.response.data.error : 'Failed to add channel. Please try again.');
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    document.title = groupDetails.groupName;
    return (
        <div id="group-container">           
            <header id="group-header">
                <PostForm />
                <p>{groupDetails.memberCount} members</p>
                <p>{groupDetails.description}</p>
                <h1>{groupDetails.groupName}</h1>
                <div id="profile-header-photo">
                    <img id="large-group-photo" src={`/${groupDetails.groupPhoto}`} alt={groupDetails.groupName} />
                    <button className="light-button" onClick={() => setIsPhotoFormVisible(!isPhotoFormVisible)}>
                        {isPhotoFormVisible ? 'Close' : 'Change Profile Photo'}
                    </button>
                    {isPhotoFormVisible && <ChangeProfilePhoto onPhotoUpdated={() => {
                        setIsPhotoFormVisible(false); 
                    }} />}
                </div>
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
                            <input type="text" name="channel_name" placeholder="Channel name" value={channelName} onChange={(e) => setChannelName(e.target.value)}/>
                            <input className="button" type="submit" value="Add" disabled={!channelName}/>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                        </form>                            
                    )}
                </div>
            </aside> 
        </div>
    );
}

export default GroupHomeAdmin;
