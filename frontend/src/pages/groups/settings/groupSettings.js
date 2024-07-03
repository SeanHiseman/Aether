import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GroupProfileView from './groupProfileView';
import GroupDeletion from './groupDeletion';

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

    document.title = "Settings";
    return (
        <div className="profile-container">  
            <div className="settings-area">
                {currentView === 'profile' ? (
                    <GroupProfileView
                        groupDetails={groupDetails}
                        setGroupDetails={setGroupDetails}
                    />
                ) : (
                    <GroupDeletion
                        group={groupDetails}
                    />
                )}
            </div>  
            <div id="right-aside">
                <nav id="channel-list">
                    <ul>
                        <h2>Settings</h2>
                        <li className="settings-item" onClick={() => setCurrentView('profile')}>Group profile</li>
                        {groupDetails.isLeader && (
                            <li 
                                className="settings-item" 
                                onClick={() => setCurrentView('groupDeletion')} 
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