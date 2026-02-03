import api from '../../api';
import Cropper from 'react-easy-crop';
import GetCroppedImg from '../../functions/getCroppedImg';
import { FaFileUpload } from 'react-icons/fa';
import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ValidateTextInput } from '../../functions/validateTextInput';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const ProfileSetup = () => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [description, setDescription] = useState('');
    const [descriptionError, setDescriptionError] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [feedPhotoFile, setFeedPhotoFile] = useState('No file chosen');
    const [imageSrc, setImageSrc] = useState(null);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [zoom, setZoom] = useState(1);
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const hasMembership = user?.has_membership;
    const MAX_FILE_SIZE = hasMembership ? 500 * 1024 * 1024 : 5 * 1024 * 1024;

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            setFeedPhotoFile('No file chosen');
            setIsFileSelected(false);
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowedTypes.includes(file.type)) {
            setErrorMessage('Please upload a valid image file (JPEG, PNG, WebP, HEIC, or HEIF)');
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

    const handleSubmit = async (event) => {
        event.preventDefault();
        //Check if there's anything to submit
        if (!isFileSelected && !description.trim()) {
            setErrorMessage('Please add a profile photo, description, or both');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return;
        }
        setIsUploading(true);
        try {
            const feed_id = user?.viewer_id;
            if (!feed_id) {
                throw new Error('Feed ID not found');
            }
            //Upload photo if selected
            if (isFileSelected && imageSrc && croppedAreaPixels) {
                const croppedBlob = await GetCroppedImg(imageSrc, croppedAreaPixels);
                const formData = new FormData();
                formData.append('new_feed_photo', croppedBlob, 'cropped.jpg');
                const photoResponse = await api.put(`/update_feed_photo/${feed_id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                if (photoResponse.data?.success) {
                    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
                    const updatedUser = { ...storedUser, feed_photo: photoResponse.data?.newPhotoPath };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                } else {
                    setErrorMessage(photoResponse.data?.message || 'Failed to update profile photo');
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
            }
            //Save description if provided
            if (description.trim()) {
                const descResponse = await api.post('/change_description', {
                    description: description.trim(),
                    feedId: feed_id
                });
                if (!descResponse.data?.success) {
                    setErrorMessage(descResponse.data?.message || 'Failed to update description');
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
            }
            //Navigate to stored redirect path or explore
            const storedPath = localStorage.getItem('authRedirectPath');
            localStorage.removeItem('authRedirectPath');
            const excludedPaths = ['/login', '/join', '/register', '/welcome', '/auth', '/verify-email', '/forgot-password', '/reset-password', '/profile-setup'];
            const isExcluded = excludedPaths.some(path => storedPath?.startsWith(path));
            const redirectPath = (storedPath && !isExcluded) ? storedPath : '/explore';
            navigate(redirectPath);
        } catch (error) {
            if (error.response?.status === 413) {
                setErrorMessage(error.response?.data?.message + (!user?.has_membership ? ". Get membership for more" : ""));
            } else {
                setErrorMessage(error.response?.data?.message || "Error, please try again");
            }
            setTimeout(() => { setErrorMessage(''); }, 10000);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDescriptionChange = (e) => {
        const input = e.target.value;
        if (input.length <= 200) {
            setDescription(input);
            if (input) {
                const result = ValidateTextInput(input, 0, 200, false);
                if (result.valid) {
                    setDescriptionError('');
                } else {
                    setDescriptionError(result.error);
                }
            } else {
                setDescriptionError('');
            }
        } else {
            setDescriptionError('No more than 200 characters');
        }
    };

    const canSubmit = (isFileSelected || description.trim()) && !descriptionError && !isUploading;

    document.title = 'Set Up Profile';
    return (
        <div className="authentication-container">
            <p className="welcome-text">Welcome to Aether Social</p>
            <p className="large-text">Set up your profile</p>
            <div className="authentication-box">
                <form onSubmit={handleSubmit}>
                    <div className="file-input" style={{ marginBottom: '20px' }}>
                        <label htmlFor="profile-photo" className="button" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <FaFileUpload />
                            <span>Choose profile photo</span>
                        </label>
                        <input
                            type="file"
                            id="profile-photo"
                            name="profile_photo"
                            accept="image/*"
                            onChange={handleFileChange}
                            hidden
                        />
                        <p className="small-text" style={{ marginTop: '10px', textAlign: 'center' }}>{feedPhotoFile}</p>
                    </div>
                    {imageSrc && (
                        <>
                            <div className="crop-container" style={{ position: 'relative', width: '100%', height: 300, marginBottom: '20px', backgroundColor: '#f0f0f0' }}>
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
                            <div style={{ marginBottom: '20px' }}>
                                <label className="small-text">Zoom:</label>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    )}
                    <div style={{ marginBottom: '20px' }}>
                        <label className="small-text" style={{ display: 'block', marginBottom: '8px' }}>
                            Tell us about yourself
                        </label>
                        <textarea
                            className="authentication-input-box"
                            placeholder="Write a short bio..."
                            value={description}
                            onChange={handleDescriptionChange}
                            rows={4}
                            style={{ width: '100%', resize: 'vertical', minHeight: '80px' }}
                        />
                        {descriptionError && <p className="error-message" style={{ marginTop: '5px' }}>{descriptionError}</p>}
                        <p className="tiny-text faded-text" style={{ marginTop: '5px' }}>
                            {description.length}/200 characters
                        </p>
                    </div>
                    {errorMessage && <p className="error-message">{errorMessage}</p>}
                    <button
                        className={canSubmit ? 'submit' : 'submit disabled'}
                        type="submit"
                        disabled={!canSubmit}
                        style={{ width: '100%', marginBottom: '10px' }}
                    >
                        {isUploading ? 'Saving...' : 'Continue'}
                    </button>
                    <p
                        className="small-text underline"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            const storedPath = localStorage.getItem('authRedirectPath');
                            localStorage.removeItem('authRedirectPath');
                            const excludedPaths = ['/login', '/join', '/register', '/welcome', '/auth', '/verify-email', '/forgot-password', '/reset-password', '/profile-setup'];
                            const isExcluded = excludedPaths.some(path => storedPath?.startsWith(path));
                            const redirectPath = (storedPath && !isExcluded) ? storedPath : '/explore';
                            navigate(redirectPath);
                        }}
                    >
                        Skip for now
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetup;
