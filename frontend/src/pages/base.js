import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import { ThemeContext } from '../themeProvider';
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
    const { setTheme } = useContext(ThemeContext);
    const [feeds, setFeeds] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [groupPhotoFile, setGroupPhotoFile] = useState('No file chosen');
    const [privateGroup, setPrivateGroup] = useState(false);
    const [profile, setProfile] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const navigate = useNavigate();

    //Fetch profile info
    useEffect(() => {
        const fetchProfile = async () => {
            if (isAuthenticated && user) {
                try {
                    const response = await axios.get(`/api/profile/${user.username}`);
                    setProfile({ ...response.data.profile });
                    const themeResponse = await axios.get('/api/get_theme');
                    setTheme(themeResponse.data.theme);
                } catch (error) {
                    if (error.response && error.response.status === 401) {
                        navigate('/login');
                    }
                }
            }
        };
        fetchProfile();
    }, [isAuthenticated, user, navigate, setTheme]);

    //Fetch feeds that a user follows
    useEffect(() => {
        const fetchFeeds = async () => {
            try {
                const response = await axios.get(`/api/feed_list/${profile.userId}`);
                if (Array.isArray(response.data)) {
                    setFeeds(response.data);
                } else {
                    setFeeds([]);
                }
            } catch (error) {
                console.error('Error fetching feed data');
                setFeeds([]);
            }
        };
        //Only called when profile has loaded
        if (profile.userId) {
            fetchFeeds();
        }
    }, [profile.userId]);

    //Create group submit handler
    const createGroupSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.append('group_id', v4());
        formData.append('group_name', groupName);
        formData.append('new_group_profile_photo', groupPhoto);
        formData.append('is_private', privateGroup);
        formData.append('user_id', profile.userId); //Adds user_id so user creating group can become an admin

        try {
            const response = await axios.post('/api/create_group', formData);
            setFeeds([...feeds, response.data]);
            //Redirect to new group
            const newGroupName = response.data.group_name;
            navigate(`/group/${newGroupName}`);
            setGroupName('');
            setShowForm(false);
        } catch (error) {
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
        }
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
                        {showForm ? 'Close': 'Create feed'}
                    </button>
                    {showForm && (
                        <form id="create-group-form" onSubmit={createGroupSubmit}>
                            <input id="group-name-input" type="text" name="Name" placeholder="Feed name..." value={groupName} onChange={(e) => setGroupName(e.target.value)}/>
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
                        {feeds.length === 0 ? (
                            <p>Followed feeds show up here</p>
                        ) : (
                            feeds.map(feed => (
                                <li className={`feed-list-item ${feed.type}`} key={feed.feed_id}>
                                    <Link className="group-list-link" to={`/${feed.type}/${feed.name}/Main`}>
                                        <img className="small-group-photo" src={`/${feed.photo}`} alt={feed.name} />
                                        <p className="group-list-text">{feed.name}</p>
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
