import React, { useContext } from 'react';
import { AuthContext } from '../authContext';
import FollowerChangeButton from '../followerChangeButton';
import ManageFriendshipButton from '../manageFriendship';

const ProfileWidget = ({ profile }) => {
    const { user } = useContext(AuthContext);
    const loggedInUserId = user.userId;
    return (
        <header id="profile-header">
            <FollowerChangeButton userId={loggedInUserId} profileId={profile.profile_id} isFollowing={profile.is_following} />
            <ManageFriendshipButton userId={loggedInUserId} receiverProfileId={profile.profile_id} receiverUserId={profile.user_id} isRequestSent={profile.is_requested} isFriend={profile.is_friend} />
            <div id="profile-header-side">
            </div>
            <div id="viewed-profile-info">
                <p className="large-text">{profile.username}</p>
                <p id="profile-bio">{profile.bio}</p>
            </div>
            <p>{profile.followerCount} followers</p>
            <div id="profile-header-photo">
                <img className="large-profile-photo" src={`/${profile.profile_photo}`} alt="Profile" />         
            </div>
        </header>
    )
}

export default ProfileWidget