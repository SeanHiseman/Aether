import axios from 'axios';
import React from 'react';

const ChangeProfilePhoto = ({ onPhotoUpdated }) => {
    const PhotoSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!formData.get('new_profile_photo')) {
            alert('No image has been uploaded.');
            return;
        }
        axios.post('/update_profile_photo', formData)
            .then(response => {
                console.log('Photo updated: ', response.data);
                onPhotoUpdated(); 
            }).catch(error => {
                console.error('Error updating photo: ', error);
            });
    }

    return (
        <form id="change-profile-photo" action="/profiles/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={PhotoSubmit}>
            <label htmlFor="new_profile_photo">Change Profile Photo:</label>
            <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
            <input className="light-button" type="submit" value="Update" />
        </form>
    );
}

export default ChangeProfilePhoto;
