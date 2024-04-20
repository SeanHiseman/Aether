import React from 'react';
import { Link } from 'react-router-dom';
import MemberChangeButton from '../memberChangeButton';

const GroupWidget = ({ group }) => {
    return (
        <div className="result-widget">
            <Link to={`/group/${group.group_name}/Main`}>
                <div id="group-text">
                    <p className="large-text">{group.group_name}</p>
                    <p id="description" >{group.description}</p>
                </div>
            </Link>
            <div id="group-members">
                <p>{group.member_count} members</p>
                <p>{group.is_private ? "Private" : "Public"}</p>
                <MemberChangeButton userId={group.user_id} groupId={group.group_id} isMember={group.is_member} isRequestSent={group.isRequestSent} isPrivate={group.is_private}/>
            </div>
            <Link to={`/group/${group.group_name}/Main`}>
                <img id="large-group-photo" src={`/${group.group_photo}`} alt={group.group_name} />
            </Link>
        </div>
    )
}

export default GroupWidget