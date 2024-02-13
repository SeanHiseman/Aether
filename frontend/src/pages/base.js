import axios from 'axios';
import React, { useContext, useRef, useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import ChatApp from '../components/chatApp';
import '../css/base.css';

const BaseLayout = () => {
    const { isAuthenticated, user } = useContext(AuthContext);
    const [profile, setProfile] = useState({ logged_in_profile_id: '', logged_in_profile_photo: '', logged_in_username: '',logged_in_user_id: ''});
    const [groups, setGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();

    //Fetch profile info
    useEffect(() => {
        if (isAuthenticated && user) {
            axios.get('/api/profileDataRouter')
            .then(response => {
                setProfile({...response.data, logged_in_user_id: response.data.logged_in_user_id });
            })
            .catch(error => {
                console.error('Error:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            })
        }
    }, [isAuthenticated, user, navigate]);

    //Fetch groups info
    useEffect(() => {
        axios.get(`/api/groups_list/${profile.logged_in_user_id}`)
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
    }, [profile.logged_in_user_id]);

    const createGroupSubmit = (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('group_id', uuidv4());
        formData.append('group_name', groupName);
        formData.append('new_group_profile_photo', groupPhoto);
        formData.append('is_private', 'false');
        //Adds user_id so user creating group can become an admin
        formData.append('user_id', profile.logged_in_user_id);

        axios.post('/api/create_group', formData)
            .then(response => {
                setGroups([...groups, response.data]);

                //Redirect to new group
                const newGroupName = response.data.group_name
                navigate(`/group/${newGroupName}`);
                setGroupName('');
        })
        .catch(error => {
            console.error('Error creating group: ', error);
            if (error.response) {
                if (error.response.status === 413) {
                    alert("File too large. Please select a file smaller than 5MB.");
                } else if (error.response.status === 400) {
                    if (error.response.data && error.response.data.error === 'Invalid file type') {
                        alert("Invalid file type. Please select a JPEG or PNG.");
                    } else {
                        alert("Error creating group. Please try again.");
                    }
                } else {
                    alert("Error creating group. Please try again.");
                }
            } else {
                alert("An unexpected error occured. Please try again.");
            }
        });
    };

    const SearchSubmit = (e) => {
        e.preventDefault();

    }

    //Toggles display of create group form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    return (
        <div className="container">
        <aside id="left-aside">
            <div id="profile-info">
                <Link id="profile-link" to={`/profile/${profile.logged_in_username}`}>
                    <img id="profile-image" src={`/${profile.logged_in_profile_photo}`} alt="Profile image" />
                    <p id="logged_in_username">{profile.logged_in_username}</p>
                </Link>
            </div>
            <nav>
                <ul>
                    <li><Link to="/home">Home</Link></li>
                    <li><Link to="/recommended">Recommended</Link></li>
                    <li><Link to="/home">Following</Link></li>
                    <li><Link to="/home">Personal</Link></li>
                </ul>
            </nav>
            <div id="create-group-section">
                <button class="button" onClick={toggleForm}>
                    {showForm ? 'Close': 'Create new Group'}
                </button>
                {showForm && (
                    <form id="create-group-form" onSubmit={createGroupSubmit}>
                        <input type="text" name="Name" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)}/>
                        <input type="file" name="Group photo" onChange={(e) => setGroupPhoto(e.target.files[0])}/>
                        <input className="button" type="submit" value="Create" disabled={!groupName}/>
                    </form>
                )}
            </div>
            <h1>Groups</h1>
            <nav id="group-list">
                <ul>
                    {groups.map(group => (
                    <li key={group.group_id}>
                        <Link className="group-list-link" to={`/group/${group.group_name}`}>
                            <img className="small-group-photo" src={`/${group.group_photo}`} alt={group.group_name} />
                            <p className="group-list-text">{group.group_name}</p>
                        </Link>
                    </li>
                    ))}
                </ul>
            </nav>
        </aside>
        <main>
            <header>
                <div className="spacer"></div>
                    <form id="search-form" onSubmit={SearchSubmit}>
                        <input type="text" id="keyword" name="keyword" placeholder="Search..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}/>
                        <input id="search-submit-button" type="submit" value="Search"/>
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
