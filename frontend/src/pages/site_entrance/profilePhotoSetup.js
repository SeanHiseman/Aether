import api from '../../api';
import Cropper from 'react-easy-crop';
import GetCroppedImg from '../../functions/getCroppedImg';
import { FaFileUpload } from 'react-icons/fa';
import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../css/authentication.css';
import '../../css/basicStyles.css';

const ProfilePhotoSetup = () => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
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

    const handleUpload = async (event) => {
        event.preventDefault();
        if (!imageSrc || !croppedAreaPixels) {
            setErrorMessage('Please upload and crop an image');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return;
        }
        setIsUploading(true);
        try {
            const croppedBlob = await GetCroppedImg(imageSrc, croppedAreaPixels);
            const formData = new FormData();
            formData.append('new_feed_photo', croppedBlob, 'cropped.jpg');

            // Get feed_id from user data
            const feed_id = user?.viewer_id;
            if (!feed_id) {
                throw new Error('Feed ID not found');
            }

            const response = await api.put(`/update_feed_photo/${feed_id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data?.success) {
                // Update user in localStorage
                const storedUser = JSON.parse(localStorage.getItem("user")) || {};
                const updatedUser = { ...storedUser, feed_photo: response.data?.newPhotoPath };
                localStorage.setItem("user", JSON.stringify(updatedUser));

                // Redirect to help page
                navigate('/help');
            } else {
                setErrorMessage(response.data?.message || 'Failed to update profile photo');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
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

    document.title = 'Choose Profile Photo';
    return (
        <div className="authentication-container">
            <p className="welcome-text">Welcome to Aether Social</p>
            <p className="large-text">Choose a profile photo</p>
            <div className="authentication-box">
                <form onSubmit={handleUpload}>
                    <div className="file-input" style={{ marginBottom: '20px' }}>
                        <label htmlFor="profile-photo" className="button" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <FaFileUpload />
                            <span>Choose photo</span>
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
                    )}
                    {imageSrc && (
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
                    )}
                    {errorMessage && <p className="error-message">{errorMessage}</p>}
                    <button
                        className={isFileSelected && !isUploading ? 'submit' : 'submit disabled'}
                        type="submit"
                        disabled={!isFileSelected || isUploading}
                        style={{ width: '100%', marginBottom: '10px' }}
                    >
                        {isUploading ? 'Uploading...' : 'Set Profile Photo'}
                    </button>
                    <Link to="/help">
                        <p className="small-text underline">Skip for now</p>
                    </Link>
                </form>
            </div>
        </div>
    );
};

export default ProfilePhotoSetup;