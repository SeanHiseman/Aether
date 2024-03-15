import axios from "axios";
import React, { useEffect, useState } from "react";
import ContentWidget from "../content_widget";
import PostForm from "../../components/postForm";

//For both viewing and uploading posts
function PostChannel({ channelId, channelName, isGroup, locationId }) {
    const [errorMessage, setErrorMessage] = useState('');
    const [posts, setPosts] = useState([]);
    const [showForm, setShowForm] = useState(false);

    //Gets posts from channel
    useEffect(() => {
        const url = isGroup ? '/api/group_channel_posts' : '/api/profile_channel_posts';
        axios.get(`${url}/${locationId}/${channelId}`)
        .then(response => {
            setPosts(response.data);
        })
        .catch(error => {
             console.error('Error getting posts:', error);
        });
    }, [channelId, locationId]);

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
                {showForm ? (
                    <PostForm onSubmit={handlePostSubmit} errorMessage={errorMessage}/>
                ) : (
                    posts.length > 0 ? (
                        <ul>
                            {posts.map(post => (
                                <ContentWidget key={post.post_id} isGroup={isGroup} post={post}/>
                            ))}
                        </ul>
                    ) : (
                        <p>No posts yet</p>
                    )
                )}
            </div>
        </div>
    );
}
export default PostChannel;