import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GroupDeletion from './groupDeletion';
import GroupMembers from './groupMembers';
import GroupProfileView from './groupProfileView';
import MemberJoinRequests from './memberJoinRequests';

function GroupSettings() {
    const { group_name } = useParams();
    const [currentView, setCurrentView] = useState('profile');
    const [groupDetails, setGroupDetails] = useState('');

    //Loads group info 
    useEffect(() => {
        const fetchGroupData = () => {
            axios.get(`/api/group/${group_name}`)
                .then(response => {
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
                })
                .catch(error => {
                    console.log("Error fetching group details:", error);
                });
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
                        <h2>Settings</h2>
                        <li className="settings-item" onClick={() => setCurrentView('profile')}>Group profile</li>
                        <li className="settings-item" onClick={() => setCurrentView('members')}>Members</li>
                        {groupDetails.isPrivate && (<li className="settings-item" onClick={() => setCurrentView('join-requests')}>Join requests</li>)}
                        {groupDetails.isLeader && (
                            <li 
                                className="settings-item" 
                                onClick={() => setCurrentView('group-deletion')} 
                                style={{color: 'red'}}
                            >
                                Delete group
                            </li>
                        )}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default GroupSettings;