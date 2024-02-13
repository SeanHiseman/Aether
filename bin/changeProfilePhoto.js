import axios from 'axios';
import React, { useState } from 'react';

const ChangeProfilePhoto = ({ onPhotoUpdated }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const PhotoSubmit = (e) => {
        e.preventDefault();
        const fileInput = e.target.elements.new_profile_photo;
        if (!fileInput.files[0]) {
            setErrorMessage('Please upload an image');
            return;
        }
        const formData = new FormData();
        formData.append('new_profile_photo', fileInput.files[0]);

        axios.post('/api/update_profile_photo', formData)
            .then(response => {
                onPhotoUpdated(); 
                setErrorMessage('');
            }).catch(error => {
                console.error('Error updating photo:', error.response ? error.response.data : error);
                setErrorMessage('Error updating photo:', error.response ? error.response.data : error);
            });
    }

    return (
        <form id="change-profile-photo" action="/profiles/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={PhotoSubmit}>
            <label htmlFor="new_profile_photo">Change Profile Photo:</label>
            <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <input className="light-button" type="submit" value="Update" />
        </form>
    );
}

export default ChangeProfilePhoto;
