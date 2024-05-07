import axios from 'axios';
import React, { useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../css/postForm.css';

const PostForm = ({ onSubmit, errorMessage }) => {
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [title, setTitle] = useState('');
    const quillRef = useRef(null);

    //Customises tool bar
    const modules = {
        toolbar: [
            ['link'],
            [{ size: []}],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [
                { list: 'ordered' },
                { list: 'bullet '},
                { indent: '-1' },
                { indent: '+1' }, 
            ],
            ['clean'],
        ]
    };

    //Handles attached files
    const handleFilesChange = (event) => {
        setFiles([...event.target.files]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);
            files.forEach((file) => {
                formData.append('files', file);
            }); 
            onSubmit(formData);
        } catch (error) {
            console.log("Upload error:", error);
        }
    };

    return (
        <div id="create-post-container">
            <form id="post-form" onSubmit={handleSubmit}>
                <input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)}/>
                <ReactQuill placeholder="Create post..." modules={modules} value={content} onChange={setContent} ref={quillRef} />
                <input type="file" accept="image/*,video/*" multiple onChange={handleFilesChange} />
                <button class="button" type="submit">Create Post</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </form>   
        </div>
    );
};

export default PostForm;