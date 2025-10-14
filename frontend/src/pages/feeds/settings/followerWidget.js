import { Link } from 'react-router-dom';
import { FaCrown, FaMinus, FaMinusCircle, FaPlusCircle } from 'react-icons/fa';

const FollowerWidget = ({ acceptRequest, rejectRequest, follower, feed, user, onRemoveFollower, onToggleAdmin, onToggleModerator, onTransferOwnership }) => {
    const imageUrl = follower?.followerFeed?.feed_photo
        ? `${follower?.followerFeed?.feed_photo}`
        : "/media/site_images/blank-profile.png";

    let role = "Follower";
    if (follower?.is_mod) role = "Moderator";
    if (follower?.is_admin) role = "Admin";
    if (follower?.followerFeed?.feed_owner === feed?.feed_owner) role = "Owner";

    return (
        <div className="explore-block bg-gray-800 rounded-lg flex flex-col items-center">
            <Link to={`/u/${follower?.followerFeed?.feed_name}`} className="w-20 h-20 rounded-full overflow-hidden mb-2">
                <img className="w-full h-full object-cover feed-img" src={imageUrl} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
            </Link>
            <p className="text-lg font-bold text-white truncate mt-1 text-center">
                {follower?.followerFeed?.feed_name}
            </p>
            {feed?.is_group && (
                <p className="text-sm text-gray-300 mb-2">{role}</p>
            )}
            {/* Action buttons - only show if not the current user */}
            {user?.user_id !== follower?.follower_id && (
                <div className="flex flex-col gap-1 mt-2 w-full">
                    {!acceptRequest && !rejectRequest && onRemoveFollower ? (
                        <>{/* Admins can make/remove moderators, except the owner */}
                        {feed?.isAdmin && !follower?.is_admin && feed?.is_group && (
                            <button className="small-icon" onClick={() => onToggleModerator(follower)}>
                                {follower.is_mod ? <FaMinusCircle /> : <FaPlusCircle />}
                                <p className="icon-text">{follower?.is_mod ? 'Remove as moderator' : 'Make moderator'}</p>
                            </button>
                        )}
                        {/* Feed owner can see and change admin status */}
                        {feed?.isAdmin && follower?.followerFeed?.feed_owner !== feed?.feed_owner && feed?.is_group && (
                            <button className="small-icon" onClick={() => onToggleAdmin(follower)}>
                                {follower?.is_admin ? <FaMinusCircle /> : <FaPlusCircle />}
                                <p className="icon-text">{follower?.is_admin ? 'Remove as admin' : 'Make admin'}</p>
                            </button>
                        )}
                        {/* Feed owner can transfer ownership, but not to themselves */}
                        {feed?.isOwner && follower?.is_admin && follower?.followerFeed?.feed_owner !== feed?.feed_owner && feed?.is_group && (
                            <button className="small-icon" onClick={() => onTransferOwnership(follower)}>
                                <FaCrown />
                                <p className="icon-text">Make Feed Owner</p>
                            </button>
                        )}
                        {/* Moderators can remove regular followers but not other moderators/admins */}
                        {(feed?.isMod && !follower?.is_admin && !follower?.is_mod) && (
                            <button className="small-icon" onClick={() => onRemoveFollower(follower)}>
                                <FaMinus />
                                <p className="icon-text">Remove follower</p>
                            </button>
                        )}</>
                    ) : acceptRequest && rejectRequest ? (
                        <>
                            <button className="small-icon" onClick={() => acceptRequest(follower)}>
                                <FaPlusCircle />
                                <p className="icon-text">Accept</p>
                            </button>
                            <button className="small-icon" onClick={() => rejectRequest(follower)}>
                                <FaMinusCircle />
                                <p className="icon-text">Reject</p>
                            </button>
                        </>
                    ) : (
                        <p className="small-text faded-text">No options provided</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default FollowerWidget;