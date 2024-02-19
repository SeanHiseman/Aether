import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../css/postForm.css';
import axios from 'axios';

const PostForm = ({ onSubmit }) => {
    const [content, setContent] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [files, setFiles] = useState([]);
    const [showForm, setShowForm] = useState(false);
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
            ['undo', 'redo']
        ]
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        onSubmit({ title, content, files, setErrorMessage});
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
                    <input type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)}/>
                    <ReactQuill placeholder="Create post..." modules={modules} value={content} onChange={setContent} />
                    <button class="light-button" type="submit">Create Post</button>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                </form>   
            )}   
        </div>
    );
};

export default PostForm;