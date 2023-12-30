import axios from 'axios';
import React from 'react';
import '../css/groups.css'; 

function GroupHomeAdmin({ group }) {
    //Uploads content to group
    const handleUploadSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        try {
            const response = await axios.post('/upload', formData, {
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
        try {
            const response = await axios.post('/add_channel', {
                channel_name: channelName,
                groupId: group.group_id
            });
        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
        }
    };

    return (
        <div>
            <header>
                <div className="banner">
                    <img className="group-photo" src={group.group_photo} alt={group.name} />
                    <h1>{group.name}</h1>
                    <p>{group.member_count} followers</p>
                    <p>{group.description}</p>
                </div>
                <div id="upload-section">
                    <p>Upload content</p>
                    <form id="upload-form" enctype="multipart/form-data" action="/upload" method="post" onSubmit={handleUploadSubmit}>
                        <input type="text" name="title" placeholder="Enter title" />
                        <input type="file" name="file" />
                        <input id="upload-submit-button" type="submit" value="Upload" />
                    </form>
                    <div id="confirmation-message"></div>
                </div>
            </header>
            <main>
                <div className="channels">
                    <h2>Channels</h2>
                    <ul>
                        {group.channels.map((channel, index) => (
                            <li key={index}>{channel}</li>
                        ))}
                    </ul>
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
