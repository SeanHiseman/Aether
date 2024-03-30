import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthCheck } from './components/authContext';
import BaseLayout from './pages/base';
import FollowingPage from './pages/feeds/following';
import FriendsPage from './pages/feeds/friends';
import GroupHome from './pages/groups/groupHome';
import GroupWrapper from './pages/groups/groupWrapper';
import HomePage from './pages/feeds/home';
import Login from './pages/site_entrance/login';
import MainPage from './pages/feeds/mains';
import MessagesPage from './pages/messages/messagesPage';
import Register from './pages/site_entrance/register';
import Profile from './pages/profiles/profile';
import ProfileWrapper from './pages/profiles/profileWrapper';

//Routes to each layout, some with the base layout wrapper
const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<AuthCheck><BaseLayout /></AuthCheck>}>
                    <Route path="home" element={<AuthCheck><HomePage /></AuthCheck>} />
                    <Route path="main" element={<AuthCheck><MainPage /></AuthCheck>} />
                    <Route path="following" element={<AuthCheck><FollowingPage /></AuthCheck>} />
                    <Route path="friends" element={<AuthCheck><FriendsPage /></AuthCheck>} />
                    <Route path="messages/:username" element={<AuthCheck><MessagesPage /></AuthCheck>} >
                        <Route path=":friend_name" element={<MessagesPage />} >
                            <Route index element={<Navigate replace to="Chat" />} />
                            <Route path=":title" element={<MessagesPage />} />
                        </Route>
                    </Route>
                    <Route path="group/:group_name" element={<AuthCheck><GroupWrapper /></AuthCheck>}>
                        <Route path=":channel_name/:channel_mode?" element={<GroupHome />}>
                            <Route index element={<Navigate replace to="Main/post" />} />
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
