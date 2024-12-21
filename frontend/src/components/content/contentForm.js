import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ContentDisplay from './contentDisplay';

const ContentForm = ({ closeForm, isEdit = false, isReply, onSubmit, postErrorMessage, postToEdit = null, setPostErrorMessage }) => {
    const [files, setFiles] = useState([]);
    const [generationRequest, setGenerationRequest] = useState('');
    const [isCode, setIsCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [codeContent, setCodeContent] = useState('');
    const [textContent, setTextContent] = useState('');
    const [title, setTitle] = useState('');
    const [useRequest, setUseRequest] = useState(false);
    const quillRef = useRef(null);
    const loadingText = "<p>Loading... (Can take up to 30 seconds)</p>";

    //Populates form if editing
    useEffect(() => {
        if (isEdit && postToEdit) {
            setTitle(postToEdit.title || '');
            //if (postToEdit.is_code) {
                setIsCode(true);
                setCodeContent(postToEdit.content);
            //} else {
                //setIsCode(false);
                //setTextContent(postToEdit.content);
            //}
        }
    }, [isEdit, postToEdit]);

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

    const generateContent = async () => {
        try {
            if (generationRequest.trim() === "") {
                setPostErrorMessage("Cannot be empty.");
                return;
            }
            if (generationRequest.length > 1000) {
                setPostErrorMessage("Cannot exceed 1000 characters.");
                return;
            }
            setIsLoading(true);
            const currentRequest = generationRequest
            setGenerationRequest('');
            const response = await axios.post('/api/generate_content', {
                currentCode: content,
                request: currentRequest,
            });
            if (response.data && response.status === 201) {
                const { generatedContent } = response.data;
                setCodeContent(generatedContent);
                setPostErrorMessage('');
            } else {
                setPostErrorMessage("Generation error");
            }
        } catch (error) {
            setPostErrorMessage("Generation error");
        } finally {
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

    const content = isCode ? codeContent : textContent;

    const handleSubmit = async (event) => {
        console.log("submitting");
        event.preventDefault();
        if (isCode) {
            if (content.trim() === "") {
                setPostErrorMessage("Content cannot be empty.");
                return;  
            }
        }
        setPostErrorMessage("");
        const formData = new FormData();
        formData.append('content', content);
        //formData.append('is_code', isCode);
        if (!isReply) formData.append('title', title);
        files.forEach((file) => {
            formData.append('files', file);
        }); 
        try {
            await onSubmit(formData);
            setCodeContent('');
            setTextContent('');
            setTitle('');
            setIsCode(false);
            setFiles([])
        } catch (error) {
            setPostErrorMessage('An error occured while submitting the form')
        }
    };

    return (
        <div className={`create-post-container ${isCode ? 'wide' : 'narrow'}`}>
            <form id="post-form" onSubmit={handleSubmit}>
                <div id="content-form-buttons">
                    {isReply && (
                        <button className="button" type="button" onClick={closeForm}>Close</button>
                    )}
                    {!isCode && (
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
                        {isEdit ? "Save Edit" : isReply ? "Reply" : "Post"}
                    </button>
                    <button className="button" type="button" onClick={() => setIsCode(!isCode)}>
                        {isCode ? "Text Editor" : "Code Editor"}
                    </button>
                    {isCode && (
                        <button className="button" type="button" onClick={generateModeToggle}>
                            {useRequest ? 'Code Mode' : 'Generate Mode'}
                        </button>
                    )}
                    {postErrorMessage && (<div className="error-message">{postErrorMessage}</div>)}
                </div>
                {!isReply && (
                    <input id="title-entry" type="text" placeholder="Add title (optional)..." value={title} onChange={(e) => setTitle(e.target.value)} />
                )}
                {!isCode ? (
                    <ReactQuill placeholder={isReply ? "Reply..." : "Start post..."} modules={modules} value={textContent} onChange={setTextContent} ref={quillRef} />
                ) : (
                    <div className="code-editor">
                        {useRequest ? (
                            <div id="generate-query-container">
                                <textarea className="content-input-form generate" placeholder="Describe your post..." value={generationRequest} onChange={(e) => setGenerationRequest(e.target.value)} />
                                <button className="button" type="button" onClick={generateContent}>Create</button>
                            </div>
                        ) : (
                            <textarea className="content-input-form code" placeholder="Enter code..." value={codeContent} onChange={(e) => setCodeContent(e.target.value)} />
                        )}
                        <div className="code-preview">
                            {isLoading ? (
                                <p>{loadingText}</p>
                            ) : (
                                <ContentDisplay content={codeContent} />
                            )}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ContentForm;