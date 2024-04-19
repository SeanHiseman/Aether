import React from 'react';
import MemberChangeButton from '../memberChangeButton';

const GroupWidget = ({ group }) => {
    return (
        <header id="group-header">
            <div id="group-members">
                <p>{group.member_count} members</p>
                <MemberChangeButton 
                    userId={group.user_id} 
                    groupId={group.group_id} 
                    isMember={group.is_member} 
                    isRequestSent={group.isRequestSent} 
                    isPrivate={group.isPrivate}
                />
            </div>
            <div id="group-text">
                <p className="large-text">{group.group_name}</p>
                <p id="description" >{group.description}</p>
            </div>
            <img id="large-group-photo" src={`/${group.group_photo}`} alt={group.group_name} />
        </header>
    )
}

export default GroupWidget