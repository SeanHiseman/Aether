import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AccountDeletion from './accountDeletion';
import ProfileView from './profileView';

//Page for all settings related to a user
const Settings = () => {
    const { username } = useParams();
    const [currentView, setCurrentView] = useState('profile');
    const [profile, setProfile] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`/api/profile/${username}`)
            .then(response => {
                const fetchedProfile = response.data.profile;
                setProfile(fetchedProfile);
            })
            .catch(error => {
                console.error('Error:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                } 
            })
    }, [username, navigate]); 

    const handleLogout = (event) => {
        event.preventDefault();
        axios.post('/api/logout')
            .then(response => {
                if (response.data.success) {
                    navigate('/login');
                } else {
                    alert('Logout failed: ', response.data.message);
                }
            })
            .catch(error => {
                alert('Error during logout: ', error);
            })
    };

    document.title = "Settings";
    return (
        <div className="profile-container">
            <div className="content-feed">
                {currentView === 'profile' ? (
                    <ProfileView
                        profile={profile}
                        setProfile={setProfile}
                    />
                ) : (
                    <AccountDeletion
                        profile={profile}
                    />
                )}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      
            </div>
            <div id="right-aside">
                <nav id="channel-list">
                    <ul>
                        <h2>Settings</h2>
                        <li className="settings-item" onClick={() => setCurrentView('profile')}>Profile</li>
                        <li className="settings-item" onClick={() => setCurrentView('accountDeletion')} style={{color: 'red'}}>Delete account</li>
                        <form id="logout-form" action="/api/logout" method="post" onSubmit={handleLogout}>
                            <button className="button" type="submit">Logout</button>
                        </form>
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default Settings;