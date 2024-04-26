import React, { useContext } from 'react';
import { AuthContext } from '../authContext';
import FollowerChangeButton from '../followerChangeButton';
import { Link } from 'react-router-dom';
import ManageFriendshipButton from '../manageFriendship';

const ProfileWidget = ({ profile }) => {
    const { user } = useContext(AuthContext);
    const loggedInUserId = user.userId;

    return (
        <div className="result-widget">
            <Link to={`/profile/${profile.user.username}`}>
                <div id="viewed-profile-info">
                    <p className="large-text">{profile.user.username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                </div>
            </Link>
            <p>{profile.is_private ? "Private" : "Public"}</p>
            <ManageFriendshipButton userId={loggedInUserId} receiverProfileId={profile.profile_id} receiverUserId={profile.user_id} isRequestSent={profile.isRequestSent} isFriend={profile.isFriend} />
            <div id="profile-header-side">
            </div>
                {profile.is_private ? (
                    null
                ) : (
                    <div>
                        <p>{profile.follower_count} followers</p>
                        <FollowerChangeButton userId={loggedInUserId} profileId={profile.profile_id} isFollowing={profile.isFollowing} isPrivate={profile.is_private}/>
                    </div>
                )}
            <Link to={`/profile/${profile.user.username}`}>
                <img className="large-profile-photo" src={`/${profile.profile_photo}`} alt="Profile" />         
            </Link>
        </div>
    )
}

export default ProfileWidget