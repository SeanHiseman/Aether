import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import BaseLayout from './pages/base';
import GroupHome from './pages/groups/groupHome';
import GroupHomeAdmin from './pages/groups/groupHomeAdmin';
import Home from './pages/home';
import Login from './pages/site_entrance/login';
import Register from './pages/site_entrance/register';
import PersonalProfile from './pages/profiles/personal_profile';
import PublicProfile from './pages/profiles/public_profile';

//Routes to each layout, some with the base layout wrapper
const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<BaseLayout />}>
                    <Route path="home" element={<Home />} />
                    <Route path="group/:groupId" element={<GroupHome />} />
                    <Route path="group/:groupId/admin" element={<GroupHomeAdmin />} />
                    <Route path="profile/:profileId" element={<PersonalProfile />} />
                    <Route path="profile/:profileId" element={<PublicProfile />} />
                </Route>
            </Routes>
        </Router>
    );
};

export default App;
