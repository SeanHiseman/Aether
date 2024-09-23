import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthCheck } from './components/authContext';
import About from './pages/welcome/about';
import Algorithm from './pages/welcome/algorithm';
import AskChannel from './pages/ask/askChannel';
import BaseLayout from './pages/base';
import Content from './pages/welcome/content';
import Feeds from './pages/welcome/feeds';
import GroupHome from './pages/groups/groupHome';
import GroupSettings from './pages/groups/settings/groupSettings';
import GroupWrapper from './pages/groups/groupWrapper';
import Join from './pages/site_entrance/join';
import Login from './pages/site_entrance/login';
import Membership from './pages/welcome/membership';
import MessagesPage from './pages/messagesPage';
import PersonalFeed from './pages/personalFeed';
import Privacy from './pages/welcome/privacy';
import Profile from './pages/profiles/profile';
import ProfileWrapper from './pages/profiles/profileWrapper';
import { QueryProvider } from './components/search/queryContext';
import SearchResults from './pages/searchResults';
import Settings from './pages/profiles/settings/settings';
import { ThemeProvider } from './themeProvider';
import WelcomeHome from './pages/welcome/welcomeHome';

const queryClient = new QueryClient(); //Sets up React Query

//Routes to each layout, some with the base layout wrapper
const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <Router>
                    <Routes>
                        <Route path="/welcome" element={<WelcomeHome />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/algorithm" element={<Algorithm />} />
                        <Route path="/content" element={<Content />} />
                        <Route path="/feeds" element={<Feeds />} />
                        <Route path="/membership" element={<Membership />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/join" element={<Join />} />
                        <Route path="/" element={<QueryProvider><AuthCheck><BaseLayout /></AuthCheck></QueryProvider>}>
                            <Route path="ask" element={<AuthCheck><AskChannel /></AuthCheck>} >
                                <Route path=":chatId" element={<QueryProvider><AuthCheck><AskChannel /></AuthCheck></QueryProvider>} />
                            </Route>
                            <Route path="p/:feed_name" element={<AuthCheck><PersonalFeed/></AuthCheck>} />
                            <Route path="settings/:username" element={<AuthCheck><Settings /></AuthCheck>} />
                            <Route path="group_settings/:group_name" element={<AuthCheck><GroupSettings /></AuthCheck>} />
                            <Route path="search/:tab?" element={<AuthCheck><SearchResults /></AuthCheck>} />
                            <Route path="messages/:username" element={<AuthCheck><MessagesPage /></AuthCheck>} >
                                <Route path=":friend_name" element={<AuthCheck><MessagesPage /></AuthCheck>} >
                                    <Route index element={<Navigate replace to="Main" />} />
                                    <Route path=":title" element={<AuthCheck><MessagesPage /></AuthCheck>} />
                                </Route>
                            </Route>
                            <Route path="g/:group_name" element={<AuthCheck><GroupWrapper /></AuthCheck>}>
                                <Route path=":channel_name" element={<AuthCheck><GroupHome /></AuthCheck>}>
                                    <Route index element={<Navigate replace to="Main" />} />
                                    <Route path=":channel_name" element={<AuthCheck><GroupHome /></AuthCheck>} />
                                </Route>
                            </Route>
                            <Route path="u/:username" element={<AuthCheck><ProfileWrapper /></AuthCheck>}>
                                <Route index element={<Navigate replace to="Main" />} />
                                <Route path=":channel_name" element={<AuthCheck><Profile /></AuthCheck>} />
                            </Route>
                        </Route>
                    </Routes>
                </Router>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

export default App;
