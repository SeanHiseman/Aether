import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthCheck } from './components/authContext';
import AskChannel from './pages/ask/askChannel';
import BaseLayout from './pages/base';
import FollowingPage from './pages/personal_feeds/following';
import FriendsPage from './pages/personal_feeds/friends';
import GroupHome from './pages/groups/groupHome';
import GroupSettings from './pages/groups/settings/groupSettings';
import GroupWrapper from './pages/groups/groupWrapper';
import Welcome from './pages/welcome';
import Login from './pages/site_entrance/login';
import MessagesPage from './pages/messagesPage';
import { QueryProvider } from './components/search/queryContext';
import RecommendedPage from './pages/personal_feeds/recommended';
import Join from './pages/site_entrance/join';
import Profile from './pages/profiles/profile';
import ProfileWrapper from './pages/profiles/profileWrapper';
import SearchResults from './pages/searchResults';
import Settings from './pages/profiles/settings/settings';
import { ThemeProvider } from './themeProvider';

//Routes to each layout, some with the base layout wrapper
const App = () => {
    return (
        <ThemeProvider>
            <Router>
                <Routes>
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/join" element={<Join />} />
                    <Route path="/" element={<QueryProvider><AuthCheck><BaseLayout /></AuthCheck></QueryProvider>}>
                            <Route path="ask" element={<AuthCheck><AskChannel /></AuthCheck>} >
                                <Route path=":chatId" element={<QueryProvider><AuthCheck><AskChannel /></AuthCheck></QueryProvider>} />
                            </Route>
                        <Route path="recommended" element={<AuthCheck><RecommendedPage /></AuthCheck>} />
                        <Route path="following" element={<AuthCheck><FollowingPage /></AuthCheck>} />
                        <Route path="friends" element={<AuthCheck><FriendsPage /></AuthCheck>} />
                        <Route path="settings/:username" element={<AuthCheck><Settings /></AuthCheck>} />
                        <Route path="group_settings/:group_name" element={<AuthCheck><GroupSettings /></AuthCheck>} />
                        <Route path="search/:tab?" element={<AuthCheck><SearchResults /></AuthCheck>} />
                        <Route path="messages/:username" element={<AuthCheck><MessagesPage /></AuthCheck>} >
                            <Route path=":friend_name" element={<AuthCheck><MessagesPage /></AuthCheck>} >
                                <Route index element={<Navigate replace to="Main" />} />
                                <Route path=":title" element={<AuthCheck><MessagesPage /></AuthCheck>} />
                            </Route>
                        </Route>
                        <Route path="group/:group_name" element={<AuthCheck><GroupWrapper /></AuthCheck>}>
                            <Route path=":channel_name" element={<AuthCheck><GroupHome /></AuthCheck>}>
                                <Route index element={<Navigate replace to="Main" />} />
                                <Route path=":channel_name" element={<AuthCheck><GroupHome /></AuthCheck>} />
                            </Route>
                        </Route>
                        <Route path="profile/:username" element={<AuthCheck><ProfileWrapper /></AuthCheck>}>
                            <Route index element={<Navigate replace to="Main" />} />
                            <Route path=":channel_name" element={<AuthCheck><Profile /></AuthCheck>} />
                        </Route>
                    </Route>
                </Routes>
            </Router>
        </ThemeProvider>
    );
};

export default App;
