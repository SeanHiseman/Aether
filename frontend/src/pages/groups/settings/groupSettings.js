import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import GroupDeletion from './groupDeletion';
import GroupMembers from './groupMembers';
import GroupProfileView from './groupProfileView';
import MemberJoinRequests from './memberJoinRequests';

const GroupSettings = () => {
    const [currentView, setCurrentView] = useState('profile');
    const [errorMessage, setErrorMessage] = useState('');
    const [groupDetails, setGroupDetails] = useState('');
    const { group_name } = useParams();

    //Loads group info 
    useEffect(() => {
        const fetchGroupData = async () => {
            try {
                const response = await axios.get(`/api/group/${group_name}`);
                const groupData = response.data;
                setGroupDetails({
                    isMember: groupData.isMember,
                    isLeader: groupData.isLeader, 
                    groupId: groupData.group_id,
                    groupName: groupData.group_name,
                    description: groupData.description,
                    groupPhoto: groupData.group_photo,
                    memberCount: groupData.member_count,
                    isPrivate: groupData.is_private,
                    isRequestSent: groupData.isRequestSent,
                    userId: groupData.userId
                });
            } catch (error) {
                setErrorMessage("Error fetching group details");
            }
        };
        fetchGroupData();
    }, [group_name]);
    

    //Switches between admin states
    const renderComponent = () => {
        switch (currentView) {
            case 'profile':
                return <GroupProfileView group={groupDetails} setGroup={setGroupDetails} />;
            case 'group-deletion':
                return <GroupDeletion group={groupDetails} />;
            case 'members':
                return <GroupMembers group={groupDetails} />;
            case 'join-requests':
                return <MemberJoinRequests group={groupDetails} />;
            default:
                return null;
        }
    };

    document.title = "Settings";
    return (
        <div className="profile-container">  
            <div className="settings-area">
                {renderComponent()}
            </div>  
            <div id="right-aside">
                <nav id="channel-list">
                    <ul>
                        <Link to={`/g/${group_name}`}>
                            <h2>{group_name}</h2>
                        </Link>
                        <div className="error-message">{errorMessage}</div>
                        <li className="settings-item" onClick={() => setCurrentView('profile')}>Feed profile</li>
                        <li className="settings-item" onClick={() => setCurrentView('members')}>Followers</li>
                        {groupDetails.isPrivate && (<li className="settings-item" onClick={() => setCurrentView('join-requests')}>Follow requests</li>)}
                        {groupDetails.isLeader && (
                            <li 
                                className="settings-item" 
                                onClick={() => setCurrentView('group-deletion')} 
                                style={{color: 'red'}}
                            >
                                Delete feed
                            </li>
                        )}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default GroupSettings;