import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/groups.css'; 
import GroupHomeAdmin from './groupHomeAdmin';
import PostForm from '../../components/postForm';

function GroupHome() {
    const { groupId } = useParams();
    const [isAdmin, setIsAdmin] = useState(false);
    const [groupDetails, setGroupDetails] = useState({ groupName: '', description: '', groupPhoto: '', memberCount: 0 });
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
                </main>
            </div>
        );
    }
}

export default GroupHome;
