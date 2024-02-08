import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthCheck } from './components/authContext';
import BaseLayout from './pages/base';
import GroupHome from './pages/groups/groupHome';
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
                <Route path="/" element={<AuthCheck><BaseLayout /></AuthCheck>}>
                    <Route path="home" element={<AuthCheck><HomePage /></AuthCheck>} />
                    <Route path="group/:group_name" element={<AuthCheck><GroupHome /></AuthCheck>} />
                    <Route path="personal-profile/:username" element={<AuthCheck><PersonalProfile /></AuthCheck>} />
                    <Route path="profile/:username" element={<AuthCheck><Profile /></AuthCheck>} />
                </Route>
            </Routes>
        </Router>
    );
};

export default App;
