import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import { AuthContext } from '../components/authContext';
import FeedItem from '../components/channels/feedItem';
import { ThemeContext } from '../themeProvider';
import { useQueryContext } from '../components/search/queryContext';
import '../css/baseLayout.css';
import '../css/basicStyles.css';
import '../css/contentFeed.css';
import '../css/groups.css';
import '../css/messages.css';
import '../css/profile.css';
import '../css/replies.css';

const BaseLayout = () => {
    const { isAuthenticated, user } = useContext(AuthContext);
    const [currentQuery, setCurrentQuery] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [feeds, setFeeds] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState(null);
    const [groupPhotoFile, setGroupPhotoFile] = useState('No file chosen');
    const [privateGroup, setPrivateGroup] = useState(false);
    const [profile, setProfile] = useState([]);
    const { setQuery } = useQueryContext();
    const { setTheme } = useContext(ThemeContext);
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
                setFeeds(response.data);
            } catch (error) {
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
        try {
            event.preventDefault();
            if (!groupName) {
                setErrorMessage('Feed needs a name');
                return;
            } else {
                const formData = new FormData();
                formData.append('group_id', v4());
                formData.append('group_name', groupName);
                formData.append('new_group_profile_photo', groupPhoto);
                formData.append('is_private', privateGroup);
                formData.append('user_id', profile.userId); //Adds user_id so user creating group can become an admin
                const response = await axios.post('/api/create_group', formData);
                if (response.data.success === true) {
                    setFeeds([...feeds, response.data]);
                    //Redirect to new group
                    const newGroupName = response.data.newGroup.group_name;
                    navigate(`/g/${newGroupName}`);
                    setGroupName('');
                    setShowForm(false);
                }
            }
        } catch (error) {
            if (error.response.status === 413) {
                setErrorMessage("File cannot be more than 5MB");
            } else if (error.response.status === 400 ) {
                setErrorMessage("Name taken");
            } else {
                setErrorMessage("Error creating feed"); 
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
    const handleAskClick = async (event) => {
        try {
            event.preventDefault();
            //Check if input bar is empty
            if (!currentQuery.trim()) {
                navigate('/ask/home');
                return;
            }
            const newChatId = v4();
            if (user.hasMembership) {
                await axios.post('/api/create_ask_chat', {
                    chatId: newChatId,
                    name: "New chat"
                });
            };
            setQuery(currentQuery);
            setCurrentQuery('');
            navigate(`/ask/${newChatId}`);
        } catch (error) {
            setErrorMessage("Error sending Ask");
        }
    };

    //Sends to search page
    const handleSearchClick = (event) => {
        event.preventDefault();
        navigate(`/search?keyword=${currentQuery}`);
    };

    //Toggles display of create group form after button is pressed
    const toggleForm = () => { 
        if (showForm) {
            setErrorMessage('');
            setGroupName('');
            setGroupPhoto(null);
            setGroupPhotoFile('No file chosen');
        };
        setShowForm(!showForm) 
    }

    return (
        <div className="container">
            <aside id="left-aside">
                <div className="profile-info">
                    <Link className="profile-link" to={`/u/${profile.username}`}>
                        <img className="profile-image" src={`/${profile.profilePhoto}`} alt="Profile" />
                        <p id="logged-in-username">{profile.username}</p>
                    </Link>
                </div>
                <nav id="personal-feeds">
                    <ul>
                        <li className="feed-link"><Link to="/p/recommended">Recommended</Link></li>
                        <li className="feed-link"><Link to="/p/following">Following</Link></li>
                        <li className="feed-link"><Link to="/p/friends">Friends</Link></li>
                    </ul>
                </nav>
                <div id="create-group-section">
                    <button className="button" onClick={toggleForm}>
                        {showForm ? 'Close': 'Create feed'}
                    </button>
                    {showForm && (
                        <form id="create-group-form" onSubmit={createGroupSubmit}>
                            <input className="name-input" type="text" name="Name" placeholder="Feed name..." value={groupName} onChange={(e) => setGroupName(e.target.value)}/>
                            <div className="file-input">
                                <label htmlFor="group-photo-input" class="dark-button">Choose photo</label>
                                <input type="file" id="group-photo-input" name="Group photo" onChange={handleFileChange} hidden/>
                                <span className="file-name">{groupPhotoFile}</span>
                            </div>
                            <div className="option-toggle">
                                <button className={privateGroup === false ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setPrivateGroup(false);}}>Public</button>
                                <button className={privateGroup === true ? 'active-mode' : 'passive-mode'} onClick={(event) => {event.preventDefault(); setPrivateGroup(true);}}>Private</button>
                            </div>
                            <div className="error-message">{errorMessage}</div>
                            <input className="dark-button" type="submit" value="Create" />
                        </form>
                    )}
                </div>
                <nav className="feed-list">
                    <ul>
                        {feeds.length === 0 ? (
                            <p>Followed feeds show up here</p>
                        ) : (
                            feeds.map((feed) => (
                                <FeedItem key={feed.feed_id} feedId={feed.feed_id} name={feed.name} photo={feed.photo} type={feed.type} link={`/${feed.type}/${feed.name}/Main`} />
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
                <Link id="messages-button" to={`/messages`}>Messages</Link>
                </header>
                <div className="content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default BaseLayout;
