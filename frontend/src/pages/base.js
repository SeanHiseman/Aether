import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import '../css/base.css';
import '../css/contentFeed.css';
import '../css/groups.css';
import '../css/messages.css';
import '../css/profile.css';
import '../css/replies.css';

const BaseLayout = () => {
    const { isAuthenticated, user } = useContext(AuthContext);
    const [currentQuery, setCurrentQuery] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [groups, setGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [groupPhotoFile, setGroupPhotoFile] = useState('No file chosen');
    const [privateGroup, setPrivateGroup] = useState(false);
    const [profile, setProfile] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();

    //Fetch profile info
    useEffect(() => {
        if (isAuthenticated && user) {
            axios.get(`/api/profile/${user.username}`)
            .then(response => {
                setProfile({...response.data.profile });
            })
            .catch(error => {
                console.error('Error:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            })
        }
    }, [isAuthenticated, user, navigate]);

    //Fetch groups that user is a part of
    useEffect(() => {
        axios.get(`/api/groups_list/${profile.userId}`)
        .then(response => {
            if (Array.isArray(response.data)) {
                setGroups(response.data);
            } else {
                setGroups([]);
            }
        })
        .catch(error => {
            console.error('Error fetching groups data:', error);
            setGroups([]);
        });
    }, [profile.userId]);

    const createGroupSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.append('group_id', v4());
        formData.append('group_name', groupName);
        formData.append('new_group_profile_photo', groupPhoto);
        formData.append('is_private', privateGroup);
        //Adds user_id so user creating group can become an admin
        formData.append('user_id', profile.userId);
        axios.post('/api/create_group', formData)
            .then(response => {
                setGroups([...groups, response.data]);
                //Redirect to new group
                const newGroupName = response.data.group_name
                navigate(`/group/${newGroupName}`);
                setGroupName('');
                setShowForm(false);
        })
        .catch(error => {
            if (error.response) {
                if (error.response.status === 413) {
                    setErrorMessage("File cannot be more than 5MB");
                } else if (error.response.status === 400) {
                    setErrorMessage(error.response.data.error || "Error, please try again");
                } else {
                    setErrorMessage("Error, please try again");
                }
            } else {
                setErrorMessage("Error, please try again");
            }
        });
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setGroupPhoto(file);
            setGroupPhotoFile(file.name);
        }
    };

    //Sends to ask page
    const handleAskClick = (event) => {
        event.preventDefault();
        navigate('/ask', { state: { query: currentQuery } });
    };
    //Sends to search page
    const handleSearchClick = (event) => {
        event.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };

    //Set groups to public or private
    const handlePublicClick = (event) => {
        event.preventDefault();
        setPrivateGroup(false);
    }
    const handlePrivateClick = (event) => {
        event.preventDefault();
        setPrivateGroup(true);
    }

    //Toggles display of create group form after button is pressed
    const toggleForm = () => {
        setShowForm(!showForm)
    }

    return (
        <div className="container">
            <aside id="left-aside">
                <div className="profile-info">
                    <Link className="profile-link" to={`/profile/${profile.username}`}>
                        <img className="profile-image" src={`/${profile.profilePhoto}`} alt="Profile" />
                        <p id="logged_in_username">{profile.username}</p>
                    </Link>
                </div>
                <nav>
                    <ul>
                        <li className="feed-link"><Link to="/recommended">Recommended</Link></li>
                        <li className="feed-link"><Link to="/following">Following</Link></li>
                        <li className="feed-link"><Link to="/friends">Friends</Link></li>
                    </ul>
                </nav>
                <div id="create-group-section">
                    <button class="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create group'}
                    </button>
                    {showForm && (
                        <form id="create-group-form" onSubmit={createGroupSubmit}>
                            <input id="group-name-input" type="text" name="Name" placeholder="Group name..." value={groupName} onChange={(e) => setGroupName(e.target.value)}/>
                            <div className="file-input">
                                <label htmlFor="group-photo-input" class="light-button">Choose photo</label>
                                <input type="file" id="group-photo-input" name="Group photo" onChange={handleFileChange} hidden/>
                                <span className="file-name">{groupPhotoFile}</span>
                            </div>
                            <div id="public-private-section">
                                <button type="button" class="light-button selected" onClick={handlePublicClick}>Public</button>
                                <button type="button" class="light-button selected" onClick={handlePrivateClick}>Private</button>
                            </div>
                            <input className="light-button" type="submit" value="Create" disabled={!groupName}/>
                            <div className="error-message">{errorMessage}</div>
                        </form>
                    )}
                </div>
                <nav id="group-list">
                    <ul>
                        {groups.length === 0 ? (
                            <p>Joined groups show up here</p>
                        ) : (
                            groups.map(group => (
                                <li key={group.group_id}>
                                    <Link className="group-list-link" to={`/group/${group.group_name}/Main`}>
                                        <img className="small-group-photo" src={`/${group.group_photo}`} alt={group.group_name} />
                                        <p className="group-list-text">{group.group_name}</p>
                                    </Link>
                                </li>
                            ))
                        )}
                    </ul>
                </nav>
            </aside>
            <main>
                <header id="base-header">
                    <div className="spacer"></div>
                        <form id="search-form" onSubmit={(e) => {
                            e.preventDefault();
                            handleSearchClick();
                        }}>
                            <div className="search-container">
                                <button className="icon-button ask" data-tooltip="Ask" type="button" onClick={handleAskClick}>
                                    <img className="standard-icon" src="/media/site_images/icons/ask.png" alt="Ask"/>
                                </button>
                                <input id="search-bar" type="text" name="keyword" placeholder="Type..." value={currentQuery} onChange={(e) => setCurrentQuery(e.target.value)}/>
                                <button className="icon-button search" data-tooltip="Search" type="submit" onClick={handleSearchClick}>
                                    <img className="standard-icon" src="/media/site_images/icons/search.png" alt="Search"/>
                                </button>
                            </div>
                        </form>
                <div className="spacer"></div>
                <Link to={`/messages/${profile.username}`}>
                    <button id="messages-button">Messages</button>
                </Link>
                </header>
                <div className="content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default BaseLayout;
