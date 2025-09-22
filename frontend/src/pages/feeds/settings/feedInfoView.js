import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import GetCroppedImg from '../../../components/getCroppedImg'; 
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
    const [newDescription, setDescription] = useState('');
    const [newName, setName] = useState('');
    const [zoom, setZoom] = useState(1);
    const { feed, setFeed, user } = useOutletContext();
    const hasMembership = user?.has_membership;
    const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024;

    useEffect(() => {
        if (isEditingName) setName(feed?.feed_name);
    }, [isEditingName, feed?.feed_name]);

    useEffect(() => {
        if (isEditingDescription) setDescription(feed?.description);
    }, [isEditingDescription, feed.description]);

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
            const response = await axios.put(`/api/update_feed_photo/${feed?.feed_id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data.success) {
                setFeed(prev => ({ ...prev, feed_photo: response.data?.newPhotoPath }));
                setIsPhotoFormVisible(false);
                setImageSrc(null);
                setIsFileSelected(false);
                setErrorMessage('');
                window.location.reload();
            } else {
                setErrorMessage(response.data.message || 'Failed to update feed photo');    
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        } catch (error) {
            if (error.response?.status === 413) {
                setErrorMessage(error.response.data?.message + (!user?.has_membership ? ". Get membership for more" : ""));
            } else {
                setErrorMessage(error.response.data?.message || "Error, please try again");
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
        if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(hasMembership ? 'File exceeds your max size limit.' : 'File exceeds your max size limit. Get membership for more.');
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
            const response = await axios.post('/api/toggle_lock', { feedId: feed?.feed_id });
            setFeed(prev => ({ ...prev, is_locked: response.data?.is_locked }));
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
            setImageSrc(null);
        }
        setIsPhotoFormVisible(!isPhotoFormVisible);
    };

    const togglePrivate = async () => {
        try {
            const response = await axios.post('/api/toggle_private', { feedId: feed?.feed_id });
            setFeed(prev => ({ ...prev, type: response.data?.type }));
        } catch (error){
            setErrorMessage('Error changing status');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const updateDescription = async () => {
        try {
            const response  = await axios.post('/api/change_description', {
                description: newDescription,
                feedId: feed?.feed_id
            });
            if (response.data.success) {
                setFeed({ ...feed, description: newDescription });
                setIsEditingDescription(false);
            } 
        } catch (error){
            setErrorMessage(error.response.data?.message || 'Error changing description');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const updateName = async () => {
        if (newName.toLowerCase() === feed?.feed_name.toLowerCase()) {
            setErrorMessage('Name is unchanged');
            return;
        }
        try {
            const route = feed?.is_group ? 'change_feed_name' : 'change_username';
            const response = await axios.post(`/api/${route}`, {
                feed_id: feed?.feed_id,
                newName,
                user_id: user?.user_id
            });
            if (response.data?.success) {
                setFeed({ ...feed, feed_name: newName });
                setIsEditingName(false);
                window.location.reload();
            } 
        } catch (error) {
		    setErrorMessage(error.response.data?.message || 'Error changing name');
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    return (
        <div className="feed-settings short">
            <div className="name-photo-area">
                <div className="feed-header-photo">
                    <img className="settings-feed-photo" src={`/${feed?.feed_photo}`} alt={feed?.feed_name} />
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
                            <p className="large-text">{feed?.feed_name}</p>
                            <button className="small-icon" onClick={() => { setIsEditingName(true); setName(feed?.feed_name); }} title="Change name"><FaPencilAlt /></button>
                        </div>
                    )}
                    {isEditingDescription ? (
                        <div className="change-name-settings">
                            <textarea className="change-name-area" value={newDescription} placeholder="Description..." 
                                onChange={(e) => {
                                    const input = e.target.value;
                                    if (input.length <= 1000) {
                                        setDescription(input);
                                        if (input) {
                                            const result = ValidateTextInput(input, 0, 1000);
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
                                        setErrorMessage("No more than 1000 characters");
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
                        <button className={feed?.type === 'public' ? 'active-mode' : 'passive-mode'} onClick={(e) => { e.preventDefault(); togglePrivate(); }} disabled={feed?.type === 'public'} title="Visible to everyone">Public</button>
                        <button className={feed?.type === 'private' ? 'active-mode' : 'passive-mode'} onClick={(e) => { e.preventDefault(); togglePrivate(); }} disabled={feed?.type === 'private'} title={feed?.is_group ? "Visible only to followers" : "Visible only to connections"}>Private</button>
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