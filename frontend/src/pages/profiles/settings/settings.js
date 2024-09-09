import axios from 'axios';
import { AuthContext } from '../../../components/authContext';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AccountDeletion from './accountDeletion';
import FriendRequests from './friendRequests';
import MembershipSettings from './membership';
import PasswordPersonal from './passwordPersonal';
import Points from './points';
import ProfileView from './profileView';
import Theme from './theme';

//Page for all settings related to a user
const Settings = () => {
    const [currentView, setCurrentView] = useState('profile');
    const [errorMessage, setErrorMessage] = useState('');
    const [profile, setProfile] = useState('');
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { username } = useParams();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await axios.get(`/api/profile/${username}`);
                const fetchedProfile = response.data.profile;
                setProfile(fetchedProfile);
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            }
        };
    
        fetchProfile();
    }, [username, navigate]);
    
    const handleLogout = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/logout');
            if (response.data.success) {
                navigate('/login');
            } else {
                setErrorMessage('Logout failed');
            }
        } catch (error) {
            setErrorMessage('Error during logout');
        }
    };

    //Switches between settings states
    const renderComponent = () => {
        switch (currentView) {
            case 'profile':
                return <ProfileView profile={profile} setProfile={setProfile} />;
            case 'points':
                return <Points user={user} setCurrentView={setCurrentView} />;
            case 'membership-settings':
                return <MembershipSettings user={user} />;
            case 'theme':
                return <Theme user={user} setCurrentView={setCurrentView} />;
            case 'friend-requests':
                return <FriendRequests  profile={profile} />;
            case 'password-personal':
                return <PasswordPersonal user={user} />;
            case 'account-deletion':
                return <AccountDeletion profile={profile} />;
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
                        <Link to={`/u/${username}`}>
                            <h2>{username}</h2>
                        </Link>
                        <div className="error-message">{errorMessage}</div>
                        <li className="settings-item" onClick={() => setCurrentView('profile')}>Profile</li>
                        <li className="settings-item" onClick={() => setCurrentView('points')}>Earnings</li>
                        <li className="settings-item" onClick={() => setCurrentView('membership-settings')}>Membership</li>
                        <li className="settings-item" onClick={() => setCurrentView('theme')}>Theme</li>
                        <li className="settings-item" onClick={() => setCurrentView('friend-requests')}>Friend requests</li>
                        <li className="settings-item" onClick={() => setCurrentView('password-personal')}>Password and personal info</li>
                        <li className="settings-item" onClick={() => setCurrentView('friend-requests')}>Friend requests</li>
                        <li className="settings-item" onClick={() => setCurrentView('account-deletion')} style={{color: 'red'}}>Delete account</li>
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