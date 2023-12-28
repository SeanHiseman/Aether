import axios from 'axios';
import React from 'react';
import '../css/groups.css'; 

function GroupProfile({ group }) {
    //Uploads content to group
    const handleSubmit = async (event) => {
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
                    <form id="upload-form" enctype="multipart/form-data" action="/upload" method="post" onSubmit={handleSubmit}>
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
            </main>
        </div>
    );
}

export default GroupProfile;
