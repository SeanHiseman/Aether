import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthCheck } from './components/authContext';
import AskChannel from './pages/askChannel';
import BaseLayout from './pages/base';
import FollowingPage from './pages/feeds/following';
import FriendsPage from './pages/feeds/friends';
import GroupHome from './pages/groups/groupHome';
import GroupSettings from './pages/groups/settings/groupSettings';
import GroupWrapper from './pages/groups/groupWrapper';
import Login from './pages/site_entrance/login';
import MessagesPage from './pages/messagesPage';
import RecommendedPage from './pages/feeds/recommended';
import Register from './pages/site_entrance/register';
import Profile from './pages/profiles/profile';
import ProfileWrapper from './pages/profiles/profileWrapper';
import SearchResults from './pages/searchResults';
import Settings from './pages/profiles/settings/settings';

//Routes to each layout, some with the base layout wrapper
const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<AuthCheck><BaseLayout /></AuthCheck>}>
                    <Route path="ask" element={<AuthCheck><AskChannel /></AuthCheck>} />
                    <Route path="recommended" element={<AuthCheck><RecommendedPage /></AuthCheck>} />
                    <Route path="following" element={<AuthCheck><FollowingPage /></AuthCheck>} />
                    <Route path="friends" element={<AuthCheck><FriendsPage /></AuthCheck>} />
                    <Route path="settings/:username" element={<AuthCheck><Settings /></AuthCheck>} />
                    <Route path="group_settings/:group_name" element={<AuthCheck><GroupSettings /></AuthCheck>} />
                    <Route path="search/:tab?" element={<AuthCheck><SearchResults /></AuthCheck>} />
                    <Route path="messages/:username" element={<AuthCheck><MessagesPage /></AuthCheck>} >
                        <Route path=":friend_name" element={<MessagesPage />} >
                            <Route index element={<Navigate replace to="General" />} />
                            <Route path=":title" element={<MessagesPage />} />
                        </Route>
                    </Route>
                    <Route path="group/:group_name" element={<AuthCheck><GroupWrapper /></AuthCheck>}>
                        <Route path=":channel_name/:channel_mode?" element={<GroupHome />}>
                            <Route index element={<Navigate replace to="Main" />} />
                            <Route path=":channel_name" element={<GroupHome />} />
                        </Route>
                    </Route>
                    <Route path="profile/:username" element={<AuthCheck><ProfileWrapper /></AuthCheck>}>
                        <Route index element={<Navigate replace to="Main" />} />
                        <Route path=":channel_name" element={<Profile />} />
                    </Route>
                </Route>
            </Routes>
        </Router>
    );
};

export default App;
