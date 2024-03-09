import axios from "axios";
import React, { useState } from "react";
import PostForm from "../../components/postForm";

function PostChannel({ channelId, channelName, isGroup, locationId }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [showForm, setShowForm] = useState(false);
    
    //Uploads content 
    const handlePostSubmit = async (formData) => {
        if (isGroup) {
            formData.append('group_id', locationId); 
        } else {
            formData.append('profile_id', locationId); 
        }
        formData.append('channel_id', channelId);
        try {
            const endpoint = isGroup ? '/api/create_group_post' : '/api/create_profile_post'
            await axios.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
            });
            } catch (error) {
                setErrorMessage("Error creating post.");
            }
    };

    //Toggle form visibility
    const toggleForm = () => {
        setShowForm(!showForm);
    };
    
    return (
        <div id="channel">
            <div id="channel-header">
                <p class="large-text">{channelName}</p>
                <button class="button" onClick={toggleForm}>
                    {showForm ? 'Close' : 'Create post'}
                </button>
            </div>
            <div id="channel-content">
                {showForm ? <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage}/> : <p>Posts go here</p>}
            </div>
        </div>
    );
}
export default PostChannel;