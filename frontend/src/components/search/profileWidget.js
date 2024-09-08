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
            <div className="name-friend-box">
                <Link to={`/u/${profile.user.username}`}>
                    <div className="search-result-profile">
                        <p className="large-widget-text">{profile.user.username}</p>
                        <p className="profile-bio">{profile.bio}</p>
                    </div>
                </Link>
            </div>
            <ManageFriendshipButton userId={loggedInUserId} receiverUserId={profile.user.user_id} isRequestSent={profile.isRequestSent} isFriend={profile.isFriend} />
            <div className="search-result-info-box">
                    <div className="result-info-options">
                        {!profile.is_private && (
                            <><p>{followerCount} {followerCount === 1 ? 'follower' : 'followers'}</p>
                            <FollowerChangeButton userId={loggedInUserId} receiverUserId={profile.user.user_id} profileId={profile.profile_id} isFollowing={isFollowing} isPrivate={profile.is_private} onFollowerChange={handleFollowerCountChange} /></>
                        )}
                        <p>{profile.is_private ? "Private" : "Public"}</p>
                    </div>
                <Link to={`/u/${profile.user.username}`}>
                    <img className="large-profile-photo" src={`/${profile.profile_photo}`} alt="Profile" />         
                </Link>
            </div>
        </div>
    )
}

export default ProfileWidget;