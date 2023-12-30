import React from 'react';
import ContentWidget from '../ContentWidget'; 

function PublicProfile({ currentProfilePhoto, username, profileBio, currentProfileId, userContent }) {
    return (
        <div className="profile-container">
            <img className="large-profile-image" src={`/static/${currentProfilePhoto}`} alt="Profile Picture" />
            <p id="large-username-text">{username}</p>
            <p id="profile-bio">{profileBio}</p>

            <div id="friend-request-root" data-receiver-id={currentProfileId}></div>

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

export default PublicProfile;
