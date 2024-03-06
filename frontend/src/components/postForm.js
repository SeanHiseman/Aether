import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../css/postForm.css';

const PostForm = ({ onSubmit, errorMessage }) => {
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [title, setTitle] = useState('');

    //Customises tool bar
    const modules = {
        //Enables undo/redo
        history: {
            delay: 2000,
            maxStack: 500,
            userOnly: false
        },
        toolbar: [
            ['image', 'video', 'link'],
            [{ size: []}],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [
                { list: 'ordered' },
                { list: 'bullet '},
                { indent: '-1' },
                { indent: '+1' }, 
            ],
            ['clean'],
            //['undo', 'redo']
        ]
    }

    const handleFileChange = (e) => {
        setFiles([...e.target.files]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        files.forEach(file => {
            formData.append('files', file);
        });

        onSubmit(formData);
    };

    return (
        <div id="create-post-container">
            <form id="post-form" onSubmit={handleSubmit}>
                <input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)}/>
                <ReactQuill placeholder="Create post..." modules={modules} value={content} onChange={setContent} />
                <input type="file" multiple onChange={handleFileChange} />
                <button class="button" type="submit">Create Post</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </form>   
        </div>
    );
};

export default PostForm;