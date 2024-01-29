import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import ChatApp from '../components/chatApp';
import '../css/base.css';

const BaseLayout = () => {
    const [profile, setProfile] = useState({ logged_in_profile_id: '', logged_in_profile_photo: '', logged_in_username: '' });
    const [groups, setGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const navigate = useNavigate();
    //Fetch profile info and groups 
    useEffect(() => {
        axios.get('/profileDataRouter')
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

        const formData = new FormData();
        formData.append('group_name', groupName);
        formData.append('new_group_profile_photo', groupPhoto)

        axios.post('/create_group', formData)
            .then(response => {
                console.log('Group created: ', response.data);
                setGroups([...groups, response.data]);

                //Redirect to new group
                const newGroupId = response.data.group_id;
                navigate(`/group/${newGroupId}`);
        })
        .catch(error => {
            console.error('Error creating group: ', error);
            if (error.response) {
                console.log('Server response: ', error.response.data);
                if (error.response.status === 413) {
                    alert("File too large. Please select a file smaller than 5MB.");
                } else if (error.response.status === 400) {
                    alert("Invalid file type. Please select a JPEG or PNG.");
                } else {
                    alert("Error creating group. Please try again.");
                }
            } else {
                alert("An unexpected error occured. Please try again.");
            }
        });
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();

    }

    return (
        <div className="container">
        <aside>
        <div className="profile-info">
            <Link id="profileLink" to={`/personal-profile/${profile.logged_in_profile_id}`}>
                <img className="profile-image" src={`${profile.logged_in_profile_photo}`} alt="Profile image" />
            </Link>
            <p id="logged_in_username">{profile.logged_in_username}</p>
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
                    <img src={group.group_photo} alt={group.group_name} />
                    {group.group_name}
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
                    disabled={!groupName}
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
            <ChatApp />
            </header>
            <div className="content">
                <Outlet />
            </div>
        </main>
        </div>
    );
};

export default BaseLayout;
