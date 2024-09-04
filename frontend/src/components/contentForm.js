import React, { useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../css/contentForm.css';

const ContentForm = ({ closeForm, isReply, onSubmit, errorMessage }) => {
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
        const newFiles = Array.from(event.target.files);
        setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const formData = new FormData();
            formData.append('content', content);
            if (!isReply) formData.append('title', title);
            files.forEach((file) => {
                formData.append('files', file);
            }); 
            await onSubmit(formData);
        } catch (error) {
            console.log("Upload error:", error);
        }
    };

    return (
        <form id="post-form" onSubmit={handleSubmit}>
            {!isReply && (<input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)}/>)}
            <ReactQuill placeholder={isReply ? "Start reply..." : "Start post..."} modules={modules} value={content} onChange={setContent} ref={quillRef} />
            <div id="content-form-buttons">
                {isReply && (<button className="button" type="button" onClick={closeForm}>Close</button>)}
                <div id="post-file-input">
                    <label htmlFor="media-input" class="button">Add media</label>
                    <input type="file" id="media-input" accept="image/*,video/*" hidden multiple onChange={handleFilesChange} />
                    <div className="file-names">
                        {files.length > 0 && (
                            <ul>
                                {files.map((file, index) => (
                                    <li key={index}>{file.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <button class="button" type="submit">{isReply ? "Reply" : "Post"}</button>
                    <div className="error-message">{errorMessage}</div>
                </div>
            </div>
        </form>   
    );
};

export default ContentForm;