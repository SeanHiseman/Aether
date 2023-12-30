import React from 'react';
import ContentWidget from '../ContentWidget'; 

function PersonalProfile({ loggedInProfilePhoto, loggedInUsername, profileBio, userContent, handlePhotoSubmit, handleLogout, handleUploadSubmit }) {
    return (
        <div className="profile-container">
            <div className="profile-header">
                <img className="large-profile-image" src={`/static/${loggedInProfilePhoto}`} alt="Profile Picture" />
                <div className="viewed-profile-info">
                    <p id="large-username-text">{loggedInUsername}</p>
                    <p id="profile-bio">{profileBio}</p>
                    <div id="update-bio"></div>
                </div>
            </div>
            <div className="profile-actions">
                <div className="form-container">
                    <form action="/profiles/update_profile_photo" method="post" enctype="multipart/form-data" onSubmit={handlePhotoSubmit}>
                        <label htmlFor="new_profile_photo">Change Profile Photo:</label>
                        <input type="file" id="new_profile_photo" name="new_profile_photo" accept="image/*" />
                        <input className="button" type="submit" value="Update" />
                    </form>           
                </div>
            </div>
            <div id="incoming-requests-root"></div>
            <form action="/logout" method="post" onSubmit={handleLogout}>
                <button className="button" type="submit">Logout</button>
            </form>
            <div id="upload-section">
                <p>Upload content</p>
                <form id="upload-form" enctype="multipart/form-data" action="/upload" method="post" onSubmit={handleUploadSubmit}>
                    <input type="text" name="title" placeholder="Enter title" />
                    <input type="file" name="file" />
                    <input id="upload-submit-button" type="submit" value="Upload" />
                </form>
                <div id="confirmation-message"></div>
            </div>
            <div className="results-wrapper">
                <div id="results">
                    {userContent.map(item => (
                        <ContentWidget key={item.post_id} item={item} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PersonalProfile;
