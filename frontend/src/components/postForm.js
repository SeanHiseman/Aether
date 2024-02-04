import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../css/postForm.css';
import axios from 'axios';

const PostForm = () => {
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [showForm, setShowForm] = useState(false);

    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('content', content);
        for (let file of files) {
            formData.append('media', file);
        }

        try {
            const response = await axios.post('create_post', formData);
        } catch (error) {
            alert("An unexpected error occured. Please try again.");
        }
    };
;   
    //Toggles display of upload form after create post button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    return (
        <div id="create-post-container">
            <button class="profile-button" onClick={toggleForm}>
                {showForm ? 'Close': 'Create new Post'}
            </button>
            {showForm && (
                <form id="post-form" onSubmit={handleSubmit}>
                    <ReactQuill value={content} onChange={setContent} />
                    <input type="file" multiple onChange={handleFileChange} />
                    <button class ="button" type="submit">Create Post</button>
                </form>   
            )}   
        </div>
    );
};

export default PostForm;