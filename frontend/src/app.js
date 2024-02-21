import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthCheck } from './components/authContext';
import BaseLayout from './pages/base';
import GroupHome from './pages/groups/groupHome';
import GroupWrapper from './pages/groups/groupWrapper';
import HomePage from './pages/home';
import Login from './pages/site_entrance/login';
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
                    <Route path="group/:group_name" element={<AuthCheck><GroupWrapper /></AuthCheck>}>
                        {/* Redirect to main channel by default */}
                        <Route index element={<Navigate replace to="main" />} />
                        <Route path=":channel_name" element={<GroupHome />} />
                    </Route>
                    <Route path="profile/:username" element={<AuthCheck><ProfileWrapper /></AuthCheck>}>
                        {/* Redirect to main channel by default */}
                        <Route index element={<Navigate replace to="main" />} />
                        <Route path=":channel_name" element={<Profile />} />
                    </Route>
                </Route>
            </Routes>
        </Router>
    );
};

export default App;
