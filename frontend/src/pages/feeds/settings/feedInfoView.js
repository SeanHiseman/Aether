import axios from 'axios';
import { FaEdit, FaFileUpload, FaLock, FaPencilAlt, FaRegWindowClose, FaSave, FaUnlock } from 'react-icons/fa';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FeedInfoView = ({ feed, setFeed, user }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState('No file chosen');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const navigate = useNavigate();
    const [newDescription, setDescription] = useState('');
    const [newName, setName] = useState('');
    const hasMembership = user?.has_membership;
    const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024;

    useEffect(() => {
        if (isEditingName) {
            setName(feed.feed_name);
        }
    }, [isEditingName, feed.feed_name]);

    useEffect(() => {
        if (isEditingDescription) {
            setDescription(feed.description);
        }
    }, [isEditingDescription, feed.description]);

    const ChangeFeedPhoto = async (event) => {
        try {
            event.preventDefault();
            const fileInput = event.target.elements.new_feed_photo;
            if (!fileInput.files[0]) {
                setErrorMessage('Please upload an image');
                setTimeout(() => { setErrorMessage(''); }, 5000);
                return;
            }
            const file = fileInput.files[0];
            if (file.size > MAX_FILE_SIZE) {
                setErrorMessage(hasMembership 
                    ? `File exceeds your max size limit.` 
                    : `File exceeds your max size limit. Get membership for more.`);
                    setTimeout(() => { setErrorMessage(''); }, 10000);
                return;
            }
            const formData = new FormData();
            formData.append('new_feed_photo', file);
            const response = await axios.put(`/api/update_feed_photo/${feed.feed_id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },    
            });
            setFeed(prevDetails => ({
                ...prevDetails,
                feed_photo: response.data.newPhotoPath
            }));
            setIsPhotoFormVisible(false);
            setErrorMessage('');
        } catch(error) {
            if (error.response && error.response.status === 413) {
                setErrorMessage(error.response.data.message + (!user.has_membership ? ". Get membership for more" : ""));
                setTimeout(() => { setErrorMessage(''); }, 10000);
            } else {
                setErrorMessage(error.response.data.message || "Error, please try again");
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setFeedPhotoFile(file.name);
            setIsFileSelected(true);
        } else {
            setFeedPhotoFile('No file chosen');
            setIsFileSelected(false);
        }
    };
    
    const toggleLock = async () => {
        try {
            const response = await axios.post('/api/toggle_lock', { feedId: feed.feed_id });
            setFeed(prevDetails => ({
                ...prevDetails,
                is_locked: response.data.is_locked
            }));
        } catch (error) {
            setErrorMessage('Error changing lock status');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const togglePhotoForm = () => {
        if (isPhotoFormVisible) {
            setErrorMessage('');
            setFeedPhotoFile('No file chosen');
            setIsFileSelected(false);
        }
        setIsPhotoFormVisible(!isPhotoFormVisible);
    };

    const togglePrivate = async () => {
        try {
            const response = await axios.post('/api/toggle_private', { feedId: feed.feed_id });
            setFeed(prevDetails => ({
                ...prevDetails, 
                type: response.data.type
            }));
        } catch (error) {
            setErrorMessage('Error changing status');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const updateDescription = async () => {
        try {
            await axios.post('/api/change_description', {
                description: newDescription,
                feedId: feed.feed_id
            });
            setFeed({ ...feed, description: newDescription });
            setIsEditingDescription(false);
        }
        catch (error) {
            setErrorMessage('Error changing description');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const updateName = async () => {
        try {
            if (!newName || newName.length === 0) {
                setErrorMessage('Name cannot be empty');
                return;
            }
            const route = feed.is_group ? 'change_feed_name' : 'change_username';
            await axios.post(`/api/${route}`, {
                feed_id: feed.feed_id,
                newName: newName,
                user_id: user.user_id
            });
            setFeed({ ...feed, feed_name: newName });
            setIsEditingName(false);
            navigate(`/feed_settings/${newName}`);
        }
        catch (error) {
            setErrorMessage('Error changing name');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    }; 

    return (
        <div className="feed-settings">  
            <div className="name-photo-area">
                <div className="feed-header-photo">
                    <img className="settings-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                    <button className="small-icon" onClick={togglePhotoForm} title={isPhotoFormVisible ? "Close" : "Change feed photo"}>
                        {isPhotoFormVisible ? <><FaRegWindowClose /><p className="icon-text">Close</p></>: <><FaEdit /><p className="icon-text">Change photo</p></>}
                    </button>
                    {isPhotoFormVisible && (
                        <form className="change-feed-photo" onSubmit={ChangeFeedPhoto}>
                            <div className="file-input">
                                <label htmlFor="new-feed-photo" className="small-icon"><FaFileUpload /><p className="icon-text">Choose photo</p></label>
                                <input type="file" id="new-feed-photo" name="new_feed_photo" accept="image/*" onChange={handleFileChange} hidden/>
                                <span className="file-name">{feedPhotoFile}</span> 
                            </div>
                            <input className={isFileSelected ? 'dark-button' : 'dark-button-disabled'} type="submit" value="Update" disabled={!isFileSelected}/>
                        </form>
                    )}
                </div>
                <div className="settings-feed-info">
                    {isEditingName ? (
                        <div className="change-name-settings">
                            <textarea className="change-name-area" style={{fontSize: '36px', height: '42px'}}value={newName} placeholder="Feed name..." onChange={(e) => {
                                e.preventDefault();
                                const input = e.target.value;
                                const inputLength = input.length;
                                if (inputLength <= 30) {
                                    setName(input);
                                } else {                                        
                                    setErrorMessage('Name cannot exceed 30 characters');
                                }
                            }}
                            />
                            <div className="cancel-save-vertical">
                                <button className="small-icon" onClick={() => {setIsEditingName(false); setName(''); setErrorMessage('');}} title="Cancel"><FaRegWindowClose /></button>
                                <button className="small-icon" onClick={(e) => {e.preventDefault(); updateName();}} title="Save"><FaSave /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name-settings">
                            <p className="text36">{feed.feed_name}</p> 
                            <button className="small-icon" onClick={() => {setIsEditingName(true); setName(feed.feed_name);}} title="Change name"><FaPencilAlt /></button>
                        </div>
                    )}
                    {isEditingDescription ? (
                        <div className="change-name-settings">
                            <textarea className="change-name-area" value={newDescription} placeholder="Description..." onChange={(e) => {
                                e.preventDefault();
                                const input = e.target.value;
                                const inputLength = input.length;
                                if (inputLength <= 1000) {
                                    setDescription(input);
                                } else {
                                    setErrorMessage('Description cannot exceed 1000 characters');
                                }
                            }}
                            />
                            <div className="cancel-save-vertical">
                                <button className="small-icon" onClick={() => {setIsEditingDescription(false); setDescription(''); setErrorMessage('');}} title="Cancel"><FaRegWindowClose /></button>
                                <button className="small-icon" onClick={(e) => {e.preventDefault(); updateDescription();}} title="Save"><FaSave /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name-settings">
                            {feed.description && feed.description.length > 0 ? (
                                <p className="text24">{feed.description}</p>
                            ) : (
                                <p className="text24 faded-text">Description...</p>
                            )}
                            <button className="small-icon" onClick={() => {setIsEditingDescription(true); setDescription(feed.description);}} title="Change description"><FaPencilAlt /></button>
                        </div>
                    )}
                    <div className="option-toggle">
                        <button 
                            className={feed.type === 'public' ? 'active-mode' : 'passive-mode'} 
                            onClick={(event) => { 
                                event.preventDefault(); 
                                togglePrivate();
                            }}
                            disabled={feed.type === 'public'}
                            title="Visible to everyone"
                        >
                            Public
                        </button>
                        <button 
                            className={feed.type === 'private' ? 'active-mode' : 'passive-mode'} 
                            onClick={(event) => { 
                                event.preventDefault(); 
                                togglePrivate();
                            }}
                            disabled={feed.type === 'private'}
                            title={feed.is_group ? "Visible only to followers" : "Visible only to connections"}
                        >
                            Private
                        </button>
                    </div>
                    {feed.is_group && (
                        <div>
                            <button className="small-icon" onClick={toggleLock} title={feed.is_locked ? "Allow regular followers to post" : "Prevent regular followers from posting"}>
                                {feed.is_locked ? <><FaUnlock /><p className="icon-text">Unlock feed</p></> : <><FaLock /><p className="icon-text">Lock feed</p></>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="error-message">{errorMessage}</div>
        </div>
    );
};

export default FeedInfoView;