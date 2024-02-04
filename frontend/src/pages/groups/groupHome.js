import axios from 'axios';
import React, { useEffect, useState } from 'react';
import '../../css/groups.css'; 
import GroupHomeAdmin from './groupHomeAdmin';

function GroupHome({ groupId }) {
    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        fetch(`/group/${groupId}`)
            .then(response => response.json())
            .then(data => {
                setIsAdmin(data.isAdmin);
            })
    }, [groupId]);
    
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

    //Load different page if user is admin
    if (isAdmin) {
        return <GroupHomeAdmin />
    } else {
        return (    
            <div>
                <header>
                    <div className="banner">
                        <img className="group-photo" src={groupId.group_photo} alt={groupId.name} />
                        <h1>{groupId.name}</h1>
                        <p>{groupId.member_count} followers</p>
                        <p>{groupId.description}</p>
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
                            {groupId.channels.map((channel, index) => (
                                <li key={index}>{channel}</li>
                            ))}
                        </ul>
                    </div>
                </main>
            </div>
        );
    }
}

export default GroupHome;
