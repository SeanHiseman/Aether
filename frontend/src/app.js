import React from 'react';
import { Navigate, Outlet, BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute, PublicAuthProvider } from './components/authContext';
import About from './pages/welcome/about';
import Account from './pages/feeds/settings/account';
import Algorithm from './pages/welcome/algorithm';
import AskChannel from './pages/ask/askChannel';
import BaseLayout from './pages/base';
import ChatPage from './pages/connections/chatPage';
import ConnectionsPage from './pages/connections/connectionsPage';
import Content from './pages/welcome/content';
import ContentWidget from './components/content/contentWidget';
import DeepFeed from './pages/deepFeed';
import Feeds from './pages/welcome/feeds';
import FeedDeletion from './pages/feeds/settings/feedDeletion';
import FeedFollowers from './pages/feeds/settings/feedFollowers';
import FollowRequests from './pages/feeds/settings/followRequests';
import FeedInfoView from './pages/feeds/settings/feedInfoView';
import FeedHome from './pages/feeds/feedHome';
import FeedSettings from './pages/feeds/settings/feedSettings';
import FeedWrapper from './pages/feeds/feedWrapper';
import Join from './pages/site_entrance/join';
import Login from './pages/site_entrance/login';
import Membership from './pages/welcome/membership';
import MembershipSettings from './pages/feeds/settings/membershipSettings';
import Placeholder from './pages/welcome/placeholder';
import Privacy from './pages/welcome/privacy';
import Team from './pages/welcome/team';
import Theme from './pages/feeds/settings/theme';
import { QueryProvider } from './components/search/queryContext';
import SearchResults from './pages/searchResults';
import { SocketProvider } from './socketProvider';
import { ThemeProvider as CustomThemeProvider } from './themeProvider';
//import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import { UnreadProvider } from './components/connections/unreadContext';
import WelcomeHome from './pages/welcome/welcomeHome';

//const muiTheme = createTheme();

//Routes to each layout, some with the base layout wrapper
const App = () => {
	const queryClient = new QueryClient(); //Sets up React Query
	const BaseLayoutWithProviders = (
		<QueryProvider>
			<PublicAuthProvider>
				<UnreadProvider>
					<BaseLayout />
				</UnreadProvider>
			</PublicAuthProvider>
		</QueryProvider>	
	);
	return (
		<QueryClientProvider client={queryClient}>
			<CustomThemeProvider>
				<SocketProvider>
					<Router>
						<Routes>
							<Route path="/" element={<Navigate to="/welcome" replace />} />
							<Route path="/welcome" element={<Outlet />}>
								<Route index element={<WelcomeHome />} />
								<Route path="about" element={<About />} />
								<Route path="algorithm" element={<Algorithm />} />
								<Route path="content" element={<Content />} />
								<Route path="feeds" element={<Feeds />} />
								<Route path="membership" element={<Membership />} />
								<Route path="contact" element={<Placeholder />} />
								<Route path="licenses" element={<Placeholder />} />
								<Route path="private-policy" element={<Placeholder />} />
								<Route path="privacy" element={<Privacy />} />
								<Route path="support" element={<Placeholder />} />
								<Route path="team" element={<Team />} />
								<Route path="terms" element={<Placeholder />} />
							</Route>
							<Route path="/login" element={<Login />} />
							<Route path="/join" element={<Join />} />
							<Route element={BaseLayoutWithProviders}>
								{/*<Route path="ask" element={<AskChannel />} >
									<Route path=":chatId" element={<AskChannel />} />
								</Route>*/}
								<Route path="g/:feed_name" element={<FeedWrapper />}>
									<Route index element={<Navigate to="Main" replace />} />
										<Route path=":channel_name" element={<FeedHome />}>
										<Route path="drafts" element={<FeedHome />} />
										<Route path=":post_id" element={<ContentWidget />} />
									</Route>
								</Route>
								<Route path="feed_settings/:feed_name" element={<ProtectedRoute><FeedSettings /></ProtectedRoute>}>
									<Route index element={<Navigate to="info" replace />} />
									<Route path="deletion" element={<FeedDeletion />} />
									<Route path="followers" element={<FeedFollowers />} />
									<Route path="follow_requests" element={<FollowRequests />} />
									<Route path="info" element={<FeedInfoView />} />
									<Route path="membership" element={<MembershipSettings />} />
									<Route path="account" element={<Account />} />
									<Route path="theme" element={<Theme />} />
								</Route>
								{/*<Route path="connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
								<Route path="connections/:connection_name" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
								<Route path="connections/:connection_name/:title" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />*/}
								<Route path="d/:deep_feed_id" element={<ProtectedRoute><DeepFeed/></ProtectedRoute>} />
								<Route path="search" element={<SearchResults />} />
								<Route path="u/:feed_name" element={<FeedWrapper />}>
									<Route index element={<Navigate to="Main" replace />} />
										<Route path=":channel_name" element={<FeedHome />}>
										<Route path="drafts" element={<FeedHome />} />
										<Route path=":post_id" element={<ContentWidget />} />
									</Route>
								</Route>
							</Route>
						</Routes>
					</Router>
				</SocketProvider>
			</CustomThemeProvider>
		</QueryClientProvider>
	);
};

export default App;
