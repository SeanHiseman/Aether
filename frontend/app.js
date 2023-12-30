import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import GroupHome from './pages/groups/groupHome';
import GroupHomeAdmin from './pages/groups/groupHomeAdmin';
import Home from './pages/home';
import Login from './pages/site_entrance/login';
import Register from './pages/site_entrance/register';
import PersonalProfile from './pages/profiles/personal_profile';
import PublicProfile from './pages/profiles/public_profile';

//Incomplete
const App = () => {
    return (
        <Router>
            <Switch>
                <Route path="/login" component={Login} />
                <Route path="/register" component={Register} />
                <Route path="/home" component={Home} />
                <Route path="/group/:groupId" component={GroupHome} />
                <Route path="/group/:groupId/admin" component={GroupHomeAdmin} />
                <Route path="/profile/:profileId" component={PersonalProfile} />
                <Route path="/profile/:profileId" component={PublicProfile} />
            </Switch>
        </Router>
    );
};
