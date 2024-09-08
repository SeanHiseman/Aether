import React from 'react';
import { Link } from 'react-router-dom';
import MemberChangeButton from '../memberChangeButton';

const GroupWidget = ({ group }) => {

    return (
        <div className="result-widget">
            <Link to={`/g/${group.group_name}/Main`}>
                <div className="group-text">
                    <p className="large-text">{group.group_name}</p>
                    <p className="description" >{group.description}</p>
                </div>
            </Link>
            <div className="group-members">
                <p>{group.member_count} {group.member_count === 1 ? 'follower' : 'followers'}</p>
                <p>{group.is_private ? "Private" : "Public"}</p>
                <MemberChangeButton userId={group.userId} groupId={group.group_id} isMember={group.isMember} isRequestSent={group.isRequestSent} isPrivate={group.is_private}/>
            </div>
            <Link to={`/g/${group.group_name}/Main`}>
                <img className="large-group-photo" src={`/${group.group_photo}`} alt={group.group_name} />
            </Link>
        </div>
    )
}

export default GroupWidget