import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FeedInfoView = ({ feed, setFeed }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState('No file chosen');
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const navigate = useNavigate();
    const [newDescription, setDescription] = useState('');
    const [newName, setName] = useState('');

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
                return;
            }
            const formData = new FormData();
            formData.append('new_feed_photo', fileInput.files[0]);
            const response = await axios.put(`/api/update_feed_photo/${feed.feed_id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },    
            })
            setFeed(prevDetails => ({
                ...prevDetails,
                feedPhoto: response.data.newPhotoPath
            }))
            setIsPhotoFormVisible(false);
            setErrorMessage('');
        } catch(error) {
            if (error.response.status === 413) {
                setErrorMessage("File cannot be more than 5MB");
            } else if (error.response.status === 400) {
                setErrorMessage(error.response.data.error || "Error, please try again");
            } else {
                setErrorMessage("Error, please try again");
            }
        };
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
    
    const togglePhotoForm = () => {
        if (isPhotoFormVisible) {
            setErrorMessage('');
            setFeedPhotoFile('No file selected');
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
        }
    };

    const updateFeedName = async () => {
        try {
            await axios.post('/api/change_feed_name', {
                feedName: newName,
                feedId: feed.feed_id
            });
            setFeed({ ...feed, feedName: newName });
            setIsEditingName(false);
            navigate(`/feed_settings/${newName}`);
        }
        catch (error) {
            setErrorMessage('Error changing name');
        }
    }; 

    return (
        <div className="profile-settings">  
            <div className="name-photo-area">
                <div className="profile-header-photo">
                    <img className="settings-profile-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                    <button className="button" onClick={togglePhotoForm}>
                        {isPhotoFormVisible ? 'Close' : 'Change feed photo'}
                    </button>
                    {isPhotoFormVisible && (
                        <form className="change-profile-photo" onSubmit={ChangeFeedPhoto}>
                            <div className="file-input">
                                <label htmlFor="new-group-photo" class="dark-button">Change feed photo</label>
                                <input type="file" id="new-group-photo" name="new_group_photo" accept="image/*" onChange={handleFileChange} hidden/>
                                <span className="file-name">{feedPhotoFile}</span> 
                            </div>
                            <input className={isFileSelected ? 'dark-button' : 'dark-button-disabled'} type="submit" value="Update" disabled={!isFileSelected}/>
                        </form>
                    )}
                </div>
                <div className="settings-profile-info">
                    <div className="chat-change">
                        {isEditingName ? (
                            <div className="change-name">
                                <textarea className="change-name-area long" value={newName} placeholder="Feed name..." onChange={(e) => {
                                    e.preventDefault();
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 30) {
                                        setName(input)
                                    } else {
                                        setErrorMessage('Name too long');
                                    }
                                }}
                                />
                                <div className="cancel-save">
                                    <button className="button" onClick={() => {
                                        setIsEditingName(false);
                                        setName('');
                                        setErrorMessage('');
                                    }}>Cancel</button>
                                    <button className="button" onClick={(e) => {
                                        e.preventDefault();
                                        updateFeedName()
                                    }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="chat-name">
                                <p className="text36">{feed.feed_name}</p> 
                                <button className="button" onClick={() => {
                                    setIsEditingName(true);
                                    setName(feed.feed_name);
                                }}>Change name</button>
                            </div>
                        )}
                    </div>
                    <div className="chat-change">
                        {isEditingDescription ? (
                            <div className="change-name">
                                <textarea className="change-text-area" value={newDescription} placeholder="Description..." onChange={(e) => {
                                    e.preventDefault();
                                    const input = e.target.value;
                                    const inputLength = input.length;
                                    if (inputLength <= 1000) {
                                        setDescription(input)
                                    } else {
                                        setErrorMessage('Description cannot exceed 1000 characters');
                                    }
                                }}
                                />
                                <div className="cancel-save">
                                    <button className="button" onClick={() => {
                                        setIsEditingDescription(false);
                                        setDescription('');
                                        setErrorMessage('');
                                    }}>Cancel</button>
                                    <button className="button" onClick={(e) => {
                                        e.preventDefault();
                                        updateDescription()
                                    }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="chat-name">
                                <p className="text24">{feed.description}</p> 
                                <button className="button" onClick={() => {
                                    setIsEditingDescription(true);
                                    setDescription(feed.description);
                                }}>Change description</button>
                            </div>
                        )}
                    </div>
                    <div className="option-toggle">
                        <button className={feed.type === 'private' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); togglePrivate();}}>Public</button>
                        <button className={feed.type === 'public' ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); togglePrivate();}}>Private</button>
                    </div>
                </div>
            </div>
            <div className="error-message">{errorMessage}</div>
        </div>
    );
}

export default FeedInfoView;