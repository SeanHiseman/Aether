import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Login from './pages/site_entrance/login';
import Register from './pages/site_entrance/register';
import Home from './pages/home';

//Needs completing
const App = () => {
    return (
        <Router>
            <Switch>
                <Route path="/login" component={Login} />
                <Route path="/register" component={Register} />
                <Route path="/home" component={Home} />
                <Route path="/group" component={Group} />
            </Switch>
        </Router>
    );
};
