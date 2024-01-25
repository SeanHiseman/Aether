import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/base.css';
import '../css/contentFeed.css';
import '../css/groups.css';
import '../css/profile.css';

const BaseLayout = () => {
    const [profile, setProfile] = useState({ profile_id: '', photo: '', username: '' });
    const [groups, setGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const navigate = useNavigate();
    //Fetch profile info and groups 
    useEffect(() => {
        axios.get('/home')
            .then(response => {
                setProfile(response.data);
            })
            .catch(error => {
                console.error('Error:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            })

        axios.get('/groups')
            .then(response => {
                if (Array.isArray(response.data)) {
                    setGroups(response.data);
                } else {
                    console.error('Expected an array for groups, received: ', response.data)
                    setGroups([]);
                }
            })
            .catch(error => {
                console.error('Error fetching groups data:', error);
                setGroups([]);
            });
    }, [navigate]);

    const createGroupSubmit = (e) => {
        e.preventDefault();

    }

    const handleSearchSubmit = (e) => {
        e.preventDefault();

    }

    return (
        <div className="container">
        <aside>
        <div className="profile-info">
            <Link id="profileLink" to={`/profiles/${profile.profile_id}`}>
                <img className="profile-image" src={`/static/${profile.photo}`} alt="Profile image" />
            </Link>
            <p id="logged_in_username">{profile.username}</p>
        </div>
        <nav>
            <ul>
                <li><Link to="/home">Home</Link></li>
                <li><Link to="/recommended">Recommended</Link></li>
                <li><Link to="/home">Following</Link></li>
                <li><Link to="/home">Personal</Link></li>
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
            <form id="create-group-form" onSubmit={createGroupSubmit}>
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
