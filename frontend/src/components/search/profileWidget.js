import React, { useContext, useState } from 'react';
import { AuthContext } from '../authContext';
import FollowerChangeButton from '../followerChangeButton';
import { Link } from 'react-router-dom';
import ManageFriendshipButton from '../manageFriendship';

const ProfileWidget = ({ profile }) => {
    const [followerCount, setFollowerCount] = useState(profile.follower_count);
    const [isFollowing, setIsFollowing] = useState(profile.isFollowing);
    const { user } = useContext(AuthContext);
    const loggedInUserId = user.userId;

    //Updates follower count number
    const handleFollowerCountChange = (newIsFollowing) => {
        setFollowerCount(prevCount => newIsFollowing ? prevCount + 1 : prevCount - 1);
        setIsFollowing(newIsFollowing);
    };

    return (
        <div className="result-widget">
            <Link to={`/profile/${profile.user.username}`}>
                <div id="viewed-profile-info">
                    <p className="large-text">{profile.user.username}</p>
                    <p id="profile-bio">{profile.bio}</p>
                </div>
            </Link>
            <p>{profile.is_private ? "Private" : "Public"}</p>
            <ManageFriendshipButton userId={loggedInUserId} receiverUserId={profile.user.user_id} isRequestSent={profile.isRequestSent} isFriend={profile.isFriend} />
            <div id="profile-header-side">
            </div>
                {profile.is_private ? (
                    null
                ) : (
                    <div>
                        <p>{followerCount} followers</p>
                        <FollowerChangeButton userId={loggedInUserId} profileId={profile.profile_id} isFollowing={isFollowing} isPrivate={profile.is_private} onFollowerChange={handleFollowerCountChange}/>
                    </div>
                )}
            <Link to={`/profile/${profile.user.username}`}>
                <img className="large-profile-photo" src={`/${profile.profile_photo}`} alt="Profile" />         
            </Link>
        </div>
    )
}

export default ProfileWidget;