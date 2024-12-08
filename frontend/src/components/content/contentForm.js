import React, { useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ContentDisplay from './contentDisplay';

const ContentForm = ({ closeForm, isReply, onSubmit, postErrorMessage, setPostErrorMessage }) => {
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [isRaw, setIsRaw] = useState(false)
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
        if (isRaw) {
            if (content.trim() === "") {
                setPostErrorMessage("Content cannot be empty.");
                return;  
            }
        }
        setPostErrorMessage("");
        const formData = new FormData();
        formData.append('content', content);
        formData.append('is_raw', isRaw);
        if (!isReply) formData.append('title', title);
        files.forEach((file) => {
            formData.append('files', file);
        }); 
        await onSubmit(formData);
    };

    return (
        <div className={`create-post-container ${isRaw ? 'wide' : 'narrow'}`}>
            <form id="post-form" onSubmit={handleSubmit}>
                <div id="content-form-buttons">
                    {isReply && (
                        <button className="button" type="button" onClick={closeForm}>Close</button>
                    )}
                    {!isRaw && (
                        <>
                            <label htmlFor="media-input" className="button">Add media</label>
                            <input type="file" id="media-input" accept="image/*,video/*" hidden multiple onChange={handleFilesChange} />
                            {files.length > 0 && (
                                <div className="file-names">
                                    <ul>
                                        {files.map((file, index) => (
                                            <li key={index}>{file.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                    <button className="button" type="submit">
                        {isReply ? "Reply" : "Post"}
                    </button>
                    <button className="button" type="button" onClick={() => setIsRaw(!isRaw)}>
                        {isRaw ? "Text Editor" : "Raw Editor"}
                    </button>
                    {postErrorMessage && (<div className="error-message">{postErrorMessage}</div>)}
                </div>
                {!isReply && (
                    <input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)} />
                )}
                {!isRaw ? (
                    <ReactQuill placeholder={isReply ? "Reply..." : "Start post..."} modules={modules} value={content} onChange={setContent} ref={quillRef} />
                ) : (
                    <div className="raw-editor">
                        <textarea className="raw-input-form" placeholder="Enter code..." value={content} onChange={(e) => setContent(e.target.value)} />
                        <div className="raw-preview">
                            <ContentDisplay content={content} />
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ContentForm;