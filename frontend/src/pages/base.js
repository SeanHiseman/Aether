import React, { useState, useEffect } from 'react';
import '../../css/base.css';
import '../../css/contentFeed.css';
import '../../css/groups.css';
import '../../css/profile.css';

const BaseLayout = () => {
    const [profile, setProfile] = useState({ id: '', photo: '', username: '' });
    const [groups, setGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');

    //Fetch profile info and groups 
    useEffect(() => {
        //Fetch profile data
        //setProfile(fetchedProfile);

        //Fetch groups data
        //setGroups(fetchedGroups);
    }, []);

    return (
        <div className="container">
        <aside>
            <div className="profile-info">
                <a id="profileLink" href={`/profiles/${profile.profile_id}`}>
                <img className="profile-image" src={`/static/${profile.photo}`} alt="Profile image" />
            </a>
            <p id="logged_in_username">{profile.username}</p>
        </div>
        <nav>
            <ul>
                <li><a href="/home">Home</a></li>
                <li><a href="/recommended">Recommended</a></li>
                <li><a href="/home">Following</a></li>
                <li><a href="/home">Personal</a></li>
            </ul>
        </nav>
        <nav>
            <ul>
                {groups.map(group => (
                <li key={group.group_id}>
                    <a href={`/group/${group.group_id}`}>
                    <img src={group.group_photo} alt={group.name} />
                    {group.name}
                    </a>
                </li>
                ))}
            </ul>
        </nav>
        <div id="create-group-section">
            <p>Create group</p>
            <form id="create-group-form" onSubmit={handleGroupSubmit}>
                <input 
                    type="text" 
                    name="Name" 
                    placeholder="Group name" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                />
                <input 
                    type="file" 
                    name="Group photo" 
                    onChange={(e) => setGroupPhoto(e.target.files[0])}
                />
                <input 
                    id="create-group-button" 
                    type="submit" 
                    value="Create"
                />
            </form>
        </div>
        </aside>
        <main>
            <header>
                <div className="spacer"></div>
                    <form id="search-form" onSubmit={handleSearchSubmit}>
                        <input 
                            type="text" 
                            id="keyword" 
                            name="keyword" 
                            placeholder="Search..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                        <input 
                            id="search-submit-button" 
                            type="submit" 
                            value="Search"
                            />
                    </form>
            <div className="spacer"></div>
            <div id="chat-app-root"></div>
            </header>
            <div className="content">
                {/* Content goes here */}
            </div>
        </main>
        </div>
    );
};

export default BaseLayout;
