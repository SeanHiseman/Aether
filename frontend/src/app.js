import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import BaseLayout from './pages/base';
import GroupHome from './pages/groups/groupHome';
import GroupHomeAdmin from './pages/groups/groupHomeAdmin';
import HomePage from './pages/home';
import Login from './pages/site_entrance/login';
import Register from './pages/site_entrance/register';
import PersonalProfile from './pages/profiles/personal_profile';
import Profile from './pages/profiles/profile';

//Routes to each layout, some with the base layout wrapper
const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<BaseLayout />}>
                    <Route path="home" element={<HomePage />} />
                    <Route path="group/:groupId" element={<GroupHome />} />
                    <Route path="group/:groupId/admin" element={<GroupHomeAdmin />} />
                    <Route path="personal-profile/:profileId" element={<PersonalProfile />} />
                    <Route path="profile/:profileId" element={<Profile />} />
                </Route>
            </Routes>
        </Router>
    );
};

export default App;
