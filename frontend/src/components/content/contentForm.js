import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ContentDisplay from './contentDisplay';
import { v4 } from 'uuid';

const ContentForm = ({ isEdit = false, isReply, onSubmit, post = null, setShowForm }) => {
    const [files, setFiles] = useState([]);
    const [generationRequest, setGenerationRequest] = useState('');
    const [isCode, setIsCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [codeContent, setCodeContent] = useState('');
    const [formErrorMessage, setFormErrorMessage] = useState('');
    const [textContent, setTextContent] = useState('');
    const [title, setTitle] = useState('');
    const [useRequest, setUseRequest] = useState(false);
    const quillRef = useRef(null);
    const loadingText = "Loading... (Can take up to 30 seconds)";
    const MAX_FILE_SIZE = 1000 * 1024 * 1024; //1gb;

    //Populates form if editing
    useEffect(() => {
        if (isEdit && post) {
            setTitle(post.title || '');
            //if (post.is_code) {
                setIsCode(true);
                setCodeContent(post.content);
            //} else {
                //setIsCode(false);
                //setTextContent(post.content);
            //}
        }
    }, [isEdit, post]);

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

    const createUniqueFilename = (originalName) => {
        const ext = originalName.substring(originalName.lastIndexOf('.'));
        return `${Date.now()}-${v4()}${ext}`;
    };

    const generateContent = async () => {
        try {
            if (generationRequest.trim() === "") {
                setFormErrorMessage("Cannot be empty.");
                return;
            }
            if (generationRequest.length > 1000) {
                setFormErrorMessage("Cannot exceed 1000 characters.");
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
                setFormErrorMessage('');
            } else {
                setFormErrorMessage("Generation error");
            }
        } catch (error) {
            setFormErrorMessage("Generation error");
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
        const oversizedFiles = newFiles.filter(file => file.size > MAX_FILE_SIZE);
        if (oversizedFiles.length > 0) {
            const oversizedNames = oversizedFiles.map(file => file.name).join(', ');
            setFormErrorMessage(`The following file(s) exceed the maximum size of 1GB: ${oversizedNames}`);
            return;
        }
        setFormErrorMessage('');
        const uniqueFiles = newFiles.map(file => {
            const uniqueFilename = createUniqueFilename(file.name);
            const newFile = new File([file], uniqueFilename, { type: file.type });
            return { originalFile: file, uniqueFile: newFile, uniqueFilename };
        });
        //Update files state with uniqueFile
        setFiles((prevFiles) => [...prevFiles, ...uniqueFiles.map(f => f.uniqueFile)]);
        if (isCode) {
            let updatedCodeContent = codeContent;
            uniqueFiles.forEach(({ uniqueFilename, uniqueFile }) => {
                const filePath = `/media/content/${uniqueFilename}`; 
                if (uniqueFile.type.startsWith('image/')) {
                    updatedCodeContent += `<img src="${filePath}" alt="${uniqueFile.name}" />`;
                } else if (uniqueFile.type.startsWith('video/')) {
                    updatedCodeContent += 
                    `<video controls>
                        <source src="${filePath}" type="${uniqueFile.type}" />
                        Your browser does not support the video tag
                    </video>`;
                } else {
                    updatedCodeContent += `<a href="${filePath}" download="${uniqueFile.name}">${uniqueFile.name}</a>`;
                }
            });
        setCodeContent(updatedCodeContent);
        }
    };

    const content = isCode ? codeContent : textContent;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isCode) {
            if (content.trim() === "") {
                setFormErrorMessage("Content cannot be empty.");
                return;  
            }
        }
        try {
            setFormErrorMessage("");
            const formData = new FormData();
            const postId = v4();
            formData.append('post_id:', postId);
            formData.append('content', content);
            formData.append('is_code', isCode);
            if (isReply) formData.append("parent_id", post.post_id);
            if (!isReply) formData.append('title', title);
            files.forEach((file) => {
                formData.append('files', file);
            }); 
            await onSubmit(formData);
            setCodeContent('');
            setTextContent('');
            setTitle('');
            setIsCode(false);
            setFiles([])
        } catch (error) {
            setFormErrorMessage('Error submitting the form')
        }
    };

    return (
        <div className={`create-post-container ${isCode ? 'wide' : 'narrow'}`}>
            <form id="post-form" onSubmit={handleSubmit}>
                <div id="content-form-buttons">
                    <button className="button" type="button" onClick={() => setShowForm(false)}>Close</button>
                    <button className="button" type="submit">
                        {isEdit ? "Save Edit" : isReply ? "Reply" : "Post"}
                    </button>
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
                    <button className="button" type="button" onClick={() => setIsCode(!isCode)}>
                        {isCode ? "Text Editor" : "Code Editor"}
                    </button>
                    {isCode && (
                        <button className="button" type="button" onClick={generateModeToggle}>
                            {useRequest ? 'Code Mode' : 'Generate Mode'}
                        </button>
                    )}
                    {formErrorMessage && (<div className="error-message">{formErrorMessage}</div>)}
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
                                <ContentDisplay content={codeContent} onOverflowChange={() => {}} showFullContent={true} showScrollBar={true}/>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ContentForm;