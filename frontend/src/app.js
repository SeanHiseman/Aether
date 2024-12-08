import React from 'react';
import { Navigate, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthCheck } from './components/authContext';
import About from './pages/welcome/about';
import Algorithm from './pages/welcome/algorithm';
import AskChannel from './pages/ask/askChannel';
import BaseLayout from './pages/base';
import Content from './pages/welcome/content';
import ContentWidget from './components/content/contentWidget';
import Feeds from './pages/welcome/feeds';
import FeedHome from './pages/feeds/feedHome';
import FeedSettings from './pages/feeds/settings/feedSettings';
import FeedWrapper from './pages/feeds/feedWrapper';
import Join from './pages/site_entrance/join';
import Login from './pages/site_entrance/login';
import Membership from './pages/welcome/membership';
import MessagesPage from './pages/messagesPage';
import PersonalFeed from './pages/personalFeed';
import Privacy from './pages/welcome/privacy';
import { QueryProvider } from './components/search/queryContext';
import SearchResults from './pages/searchResults';
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
                            <Route path="ask" element={<AskChannel />} >
                                <Route path=":chatId" element={<AskChannel />} />
                            </Route>
                            <Route path="g/:feed_name" element={<FeedWrapper />}>
                                <Route index element={<Navigate replace to="Main" />} />
                                <Route path=":channel_name" element={<FeedHome />} >
                                    <Route path=":postId" element={<ContentWidget />} />
                                </Route>
                            </Route>
                            <Route path="feed_settings/:feed_name" element={<FeedSettings />} />
                            <Route path="messages" element={<MessagesPage />} >
                                <Route path=":connection_name" element={<MessagesPage />} >
                                    <Route index element={<Navigate replace to="Main" />} />
                                    <Route path=":title" element={<MessagesPage />} />
                                </Route>
                            </Route>
                            <Route path="p/:feed_name" element={<PersonalFeed/>} />
                            <Route path="search" element={<SearchResults />} />
                            <Route path="u/:feed_name" element={<FeedWrapper />}>
                                <Route index element={<Navigate replace to="Main" />} />
                                <Route path=":channel_name" element={<FeedHome />} >
                                    <Route path=":postId" element={<ContentWidget />} />
                                </Route>
                            </Route>
                        </Route>
                    </Routes>
                </Router>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

export default App;
