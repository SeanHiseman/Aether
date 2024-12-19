import axios from 'axios';
import React, { useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ContentDisplay from './contentDisplay';

const ContentForm = ({ closeForm, isReply, onSubmit, postErrorMessage, setPostErrorMessage }) => {
    const [files, setFiles] = useState([]);
    const [generationRequest, setGenerationRequest] = useState('');
    const [isRaw, setIsRaw] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [rawContent, setRawContent] = useState('');
    const [textContent, setTextContent] = useState('');
    const [title, setTitle] = useState('');
    const [useRequest, setUseRequest] = useState(false);
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

    const generateContent = async (content) => {
        try {
            if (content.trim() === '') {
                setPostErrorMessage('Please enter a request');
                return;
            } else {
                setIsLoading(true);
                setGenerationRequest('');
                const response = await axios.post('/api/generate_content', {
                    requestContent: content,
                });
                if (response.data && response.status === 201) {
                    const { generatedContent } = response.data;
                    setRawContent(generatedContent);
                    setPostErrorMessage('');
                } else {
                    setPostErrorMessage("Generation error");
                    setIsLoading(false);
                }
            }
        } catch (error) {
            setPostErrorMessage("Generation error");
            setIsLoading(false);
        }
    };

    const generateModeToggle = () => {
        setUseRequest((prev) => !prev);
    };

    //Handles attached files
    const handleFilesChange = (event) => {
        const newFiles = Array.from(event.target.files);
        setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    };

    const content = isRaw ? rawContent : textContent;

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
        try {
            await onSubmit(formData);
            setRawContent('');
            setTextContent('');
            setTitle([]);
            setIsRaw(false);
        } catch (error) {
            setPostErrorMessage('An error occured while submitting the form')
        }
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
                    {isRaw && (
                        <button className="button" type="button" onClick={generateModeToggle}>
                            {useRequest ? 'Code Mode' : 'Generate Mode'}
                        </button>
                    )}
                    {postErrorMessage && (<div className="error-message">{postErrorMessage}</div>)}
                </div>
                {!isReply && (
                    <input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)} />
                )}
                {!isRaw ? (
                    <ReactQuill placeholder={isReply ? "Reply..." : "Start post..."} modules={modules} value={textContent} onChange={setTextContent} ref={quillRef} />
                ) : (
                    <div className="raw-editor">
                        {useRequest ? (
                            <>
                                <textarea className="raw-input-form" placeholder="Describe your post..." value={generationRequest} onChange={(e) => setGenerationRequest(e.target.value)} />
                                <button className="button" type="button" onClick={generateContent} />
                            </>
                        ) : (
                            <textarea className="raw-input-form" placeholder="Enter code..." value={content} onChange={(e) => setRawContent(e.target.value)} />
                        )}
                        <div className="raw-preview">
                            {isLoading ? (
                                <div>Loading...</div>
                            ) : (
                                <ContentDisplay content={rawContent} />
                            )}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ContentForm;