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

    //Customises tool bar
    const modules = {
        toolbar: [
            [{ header: '1'}, { header: '2'}, { font: []}],
            [{ size: []}],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [
                { list: 'ordered' },
                { list: 'bullet '},
                { indent: '-1' },
                { indent: '+1' }, 
            ],
            ['link', 'image', 'video'],
            ['clean'],
        ]
    }

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
            <button class="light-button" onClick={toggleForm}>
                {showForm ? 'Close': 'Create new Post'}
            </button>
            {showForm && (
                <form id="post-form" onSubmit={handleSubmit}>
                    <ReactQuill modules={modules} value={content} onChange={setContent} />
                    <input type="file" multiple onChange={handleFileChange} />
                    <button class="light-button" type="submit">Create Post</button>
                </form>   
            )}   
        </div>
    );
};

export default PostForm;