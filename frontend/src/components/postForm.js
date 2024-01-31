import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import axios from 'axios';

const PostForm = () => {
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);

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

    return (
        <form onSubmit={handleSubmit}>
            <ReactQuill value={content} onChange={setContent} />
            <input type="file" multiple onChange={handleFileChange} />
            <button type="submit">Create Post</button>
        </form>
    );
};

export default PostForm;