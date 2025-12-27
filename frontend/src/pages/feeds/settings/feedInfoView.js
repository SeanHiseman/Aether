import api from '../../../api';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import GetCroppedImg from '../../../functions/getCroppedImg';
import { FaEdit, FaRegWindowClose, FaSave, FaFileUpload, FaPencilAlt, FaLock, FaUnlock } from 'react-icons/fa';
import { ValidateTextInput } from '../../../functions/validateTextInput';

const FeedInfoView = () => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState('No file chosen');
    const [imageSrc, setImageSrc] = useState(null);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [isNewDescriptionValid, setIsNewDescriptionValid] = useState(true);
    const [isNewNameValid, setIsNewNameValid] = useState(true);
    const [isPhotoFormVisible, setIsPhotoFormVisible] = useState(false);
    const navigate = useNavigate();
    const [newDescription, setDescription] = useState('');
    const [newName, setName] = useState('');
    const [zoom, setZoom] = useState(1);
    const { feed, setFeed, user, updateFeeds } = useOutletContext();
    const hasMembership = user?.has_membership;
    const MAX_FILE_SIZE = hasMembership ? 500 * 1024 * 1024 : 5 * 1024 * 1024; // 500MB for members, 5MB for non-members

    useEffect(() => {
        if (isEditingName) setName(feed?.feed_name);
    }, [isEditingName, feed?.feed_name]);

    useEffect(() => {
        if (isEditingDescription) setDescription(feed?.description);
    }, [isEditingDescription, feed?.description]);

    const changeFeedPhoto = async (event) => {
        event.preventDefault();
        if (!imageSrc || !croppedAreaPixels) {
            setErrorMessage('Please upload and crop an image');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return;
        }
        try {
            const croppedBlob = await GetCroppedImg(imageSrc, croppedAreaPixels);
            const formData = new FormData();
            formData.append('new_feed_photo', croppedBlob, 'cropped.jpg');
            const response = await api.put(`/update_feed_photo/${feed?.feed_id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data?.success) {
                setFeed(prev => ({ ...prev, feed_photo: response.data?.newPhotoPath }));
                if (feed?.is_group) {
                    const stored = JSON.parse(localStorage.getItem("followedFeeds")) || [];
                    const updated = stored.map(f => f?.feed_id === feed?.feed_id ? { ...f, feed_photo: response.data?.newPhotoPath } : f);
                    localStorage.setItem("followedFeeds", JSON.stringify(updated));
                } else if (!feed?.is_group) {
                    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
                    const updatedUser = { ...storedUser, feed_photo: response.data?.newPhotoPath };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                    setFeed(prev => ({ ...prev, feed_photo: response.data?.newPhotoPath }));
                }
                setIsPhotoFormVisible(false);
                setImageSrc(null);
                setIsFileSelected(false);
                setErrorMessage('');
                updateFeeds();
            } else {
                setErrorMessage(response.data?.message || 'Failed to update feed photo');    
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        } catch (error) {
            if (error.response?.status === 413) {
                setErrorMessage(error.response?.data?.message + (!user?.has_membership ? ". Get membership for more" : ""));
            } else {
                setErrorMessage(error.response?.data?.message || "Error, please try again");
            }
            setTimeout(() => { setErrorMessage(''); }, 10000);
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            setFeedPhotoFile('No file chosen');
            setIsFileSelected(false);
            return;
        }
        const allowedTypes = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
        if (!allowedTypes.includes(file.type)) {
            setErrorMessage('Please upload a valid image file (JPEG, PNG, GIF, WebP, or BMP)');
            setTimeout(() => { setErrorMessage(''); }, 10000);
            event.target.value = '';
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(hasMembership ? 'File exceeds max size limit.' : 'File exceeds max size limit. Get membership for more.');
            setTimeout(() => { setErrorMessage(''); }, 10000);
            return;
        }
        setFeedPhotoFile(file.name);
        setIsFileSelected(true);
        const reader = new FileReader();
        reader.onload = () => setImageSrc(reader.result);
        reader.readAsDataURL(file);
    };

    const onCropComplete = useCallback((_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const toggleLock = async () => {
        try {
            const response = await api.post('/toggle_lock', { feedId: feed?.feed_id });
            setFeed(prev => ({ ...prev, is_locked: response.data?.is_locked }));
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error changing lock status');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const togglePhotoForm = () => {
        if (isPhotoFormVisible) {
            setErrorMessage('');
            setFeedPhotoFile('No file chosen');
            setIsFileSelected(false);
            setImageSrc(null);
        }
        setIsPhotoFormVisible(!isPhotoFormVisible);
    };

    const togglePrivate = async () => {
        try {
            const response = await api.post('/toggle_private', { feedId: feed?.feed_id });
            setFeed(prev => ({ ...prev, type: response.data?.type }));
        } catch (error){
            setErrorMessage(error.response?.data?.message || 'Error changing status');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const updateDescription = async () => {
        try {
            const response  = await api.post('/change_description', {
                description: newDescription,
                feedId: feed?.feed_id
            });
            if (response.data.success) {
                setFeed({ ...feed, description: newDescription });
                setIsEditingDescription(false);
            } 
        } catch (error){
            setErrorMessage(error.response?.data?.message || 'Error changing description');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const updateName = async () => {
        if (newName === feed?.feed_name) {
            setErrorMessage('Name is unchanged');
            return;
        }
        try {
            const route = feed?.is_group ? 'change_feed_name' : 'change_username';
            const response = await api.post(`/${route}`, {
                feed_id: feed?.feed_id,
                newName,
                user_id: user?.user_id
            });
            if (response.data?.success) {
                if (feed?.is_group) {
                    const stored = JSON.parse(localStorage.getItem("followedFeeds")) || [];
                    const updated = stored.map(f => f.feed_id === feed?.feed_id ? { ...f, feed_name: newName } : f);
                    localStorage.setItem("followedFeeds", JSON.stringify(updated));
                } else if (!feed?.is_group) {
                    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
                    const updatedUser = { ...storedUser, feed_name: newName };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                }
                setFeed({ ...feed, feed_name: newName });
                setIsEditingName(false);
                updateFeeds(); 
                setTimeout(() => navigate(`/settings/${newName}/info`), 0); //ensures navigation happens after state updates
            }
        } catch (error) {
		    setErrorMessage(error.response?.data?.message || 'Error changing name');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    document.title = `${feed?.feed_name} settings`;
    return (
        <div className="feed-settings short">
            <div className="name-photo-area">
                <div className="feed-header-photo">
                    <img className="settings-feed-photo" src={`${feed?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                    <button className="small-icon" onClick={togglePhotoForm} title={isPhotoFormVisible ? "Close" : "Change feed photo"}>
                        {isPhotoFormVisible ? <><FaRegWindowClose /><p className="icon-text">Close</p></> : <><FaEdit /><p className="icon-text">Change photo</p></>}
                    </button>
                    {isPhotoFormVisible && (
                        <form className="change-feed-photo" onSubmit={changeFeedPhoto}>
                            <div className="file-input">
                                <label htmlFor="new-feed-photo" className="small-icon"><FaFileUpload /><p className="icon-text">Choose photo</p></label>
                                <input type="file" id="new-feed-photo" name="new_feed_photo" accept="image/*" onChange={handleFileChange} hidden />
                                <p className="small-text">{feedPhotoFile}</p>
                            </div>
                            {imageSrc && (
                                <div className="crop-container" style={{ position: 'relative', width: '100%', height:100 }}>
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={onCropComplete}
                                    />
                                </div>
                            )}
                            <input className={isFileSelected ? 'dark-button' : 'dark-button-disabled'} type="submit" value="Update" disabled={!isFileSelected} />
                        </form>
                    )}
                </div>
                <div className="settings-feed-info">
                    {isEditingName ? (
                        <div className="change-name-settings">
                            <textarea className="change-name-area large-text" value={newName} placeholder="Feed name..." 
                                onChange={(e) => {
                                    const input = e.target.value;
                                    if (input.length <= 30) {
                                        setName(input);
                                        if (input) {
                                            const result = ValidateTextInput(input, 0, 30);
                                            if (result.valid) {
                                                setErrorMessage("");
                                                setIsNewNameValid(true);
                                            } else {
                                                setErrorMessage(result.error);
                                                setIsNewNameValid(false);
                                            }
                                        } else {
                                            setErrorMessage("");
                                            setIsNewNameValid(false);
                                        }
                                    } else {
                                        setErrorMessage("No more than 30 characters");
                                        setIsNewNameValid(false);
                                    }
                                }}
                            />
                            <div className="cancel-save-vertical">
                                <button className="small-icon" onClick={() => { setIsEditingName(false); setName(''); setErrorMessage(''); }} title="Cancel"><FaRegWindowClose /></button>
                                <button className={!isNewNameValid ? "small-icon disabled" : "small-icon"}  onClick={(e) => { e.preventDefault(); updateName(); }} title="Save"><FaSave /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name-settings">
                            <p className="large-text bold">{feed?.feed_name}</p>
                            <button className="small-icon" onClick={() => { setIsEditingName(true); setName(feed?.feed_name); }} title="Change name"><FaPencilAlt /></button>
                        </div>
                    )}
                    {isEditingDescription ? (
                        <div className="change-name-settings">
                            <textarea className="change-name-area" value={newDescription} placeholder="Description..." 
                                onChange={(e) => {
                                    const input = e.target.value;
                                    if (input.length <= 200) {
                                        setDescription(input);
                                        if (input) {
                                            const result = ValidateTextInput(input, 0, 200, false);
                                            if (result.valid) {
                                                setErrorMessage("");
                                                setIsNewDescriptionValid(true);
                                            } else {
                                                setErrorMessage(result.error);
                                                setIsNewDescriptionValid(false);
                                            }
                                        } else {
                                            setErrorMessage("");
                                            setIsNewDescriptionValid(false);
                                        }
                                    } else {
                                        setErrorMessage("No more than 200 characters");
                                        setIsNewDescriptionValid(false);
                                    }
                                }}
                            />
                            <div className="cancel-save-vertical">
                                <button className="small-icon" onClick={() => { setIsEditingDescription(false); setDescription(''); setErrorMessage(''); }} title="Cancel"><FaRegWindowClose /></button>
                                <button className={!isNewDescriptionValid ? "small-icon disabled" : "small-icon"} onClick={(e) => { e.preventDefault(); updateDescription(); }} title="Save"><FaSave /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name-settings">
                            <p className="medium-text">{feed.description || <span className="faded-text">Description...</span>}</p>
                            <button className="small-icon" onClick={() => { setIsEditingDescription(true); setDescription(feed?.description); }} title="Change description"><FaPencilAlt /></button>
                        </div>
                    )}
                    <div className="option-toggle">
                        <button className={feed?.type === 'public' ? 'active-mode' : 'passive-mode'} onClick={(e) => { e.preventDefault(); togglePrivate(); }} disabled={feed?.type === 'public'} title={`Visible to everyone${feed?.type === 'public' ? ' (current)' : ''}`}>Public</button>
                        <button className={feed?.type === 'private' ? 'active-mode' : 'passive-mode'} onClick={(e) => { e.preventDefault(); togglePrivate(); }} disabled={feed?.type === 'private'} title={`${feed?.is_group ? "Visible only to followers" : "Visible only to connections"}${feed?.type === 'private' ? ' (current)' : ''}`}>Private</button>
                    </div>
                    {feed?.is_group && (
                        <div>
                            <button className="small-icon" onClick={toggleLock} title={feed?.is_locked ? "Allow regular followers to post" : "Prevent regular followers from posting"}>
                                {feed?.is_locked ? <><FaUnlock /><p className="icon-text">Unlock feed</p></> : <><FaLock /><p className="icon-text">Lock feed</p></>}
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