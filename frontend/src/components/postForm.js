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
        ]
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const editor = quillRef.current.getEditor();
            const content = editor.getContents();
            const formData = new FormData();
            formData.append('title', title);
            const formattedContent = content.ops.map((op) => {
                if (op.insert && typeof op.insert === 'string') {
                    return op.insert;
                } else if (op.insert && op.insert.image) {
                    return `<img src="/media/content/${op.insert.image}">`;
                } else if (op.insert && op.insert.video) {
                    return `<video src="/media/content/${op.insert.video}">`;
                }
                return '';
            }).join('');

            formData.append('content', formattedContent);
            files.forEach(file => {
                formData.append('files', file);
            });

            onSubmit(formData);
        } catch (error) {
            console.error("Upload error:", error);
        }
    };

    return (
        <div id="create-post-container">
            <form id="post-form" onSubmit={handleSubmit}>
                <input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)}/>
                <ReactQuill placeholder="Create post..." modules={modules} value={content} onChange={setContent} ref={quillRef} />
                <button class="button" type="submit">Create Post</button>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
            </form>   
        </div>
    );
};

export default PostForm;