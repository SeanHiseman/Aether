import api from "../api";
import AlgorithmSelector from "../algorithms/algorithmSelector";
import { AuthContext } from "../components/authContext";
import { capitalise } from "../functions/capitalise";
import ConfirmModal from "../components/modals/confirmModal";
import DisconnectSocialButton from "./disconnectSocialButton";
import ExternalPostWidget from "./externalPostWidget";
import { refreshConnectedAccounts } from "../functions/refreshConnectedAccounts";
import SwipeableAside from "../components/swipeableAside";
import { useContext, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";

export default function SocialFeedPage({ platform }) {
	const [errorMessage, setErrorMessage] = useState('');
	const { isAuthenticated } = useContext(AuthContext);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const [posts, setPosts] = useState([]);
	const [refreshTrigger, setRefreshTrigger] = useState(false);
	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const justConnected = params.get("connected") === "true";
	const [modalOpen, setModalOpen] = useState(false);
	const isFetchingRef = useRef(false);
	const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext(); 
	const scrollRef = useRef(null);
	const hasLoadedRef = useRef(false); 
	const navigate = useNavigate();

	const isMobile = () => window.matchMedia("(max-width:768px)").matches;
    
    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

	async function loadFeed(isNextPage = false) {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}
		if (isFetchingRef.current) return;
		isFetchingRef.current = true;
		if (isNextPage) {
			setLoadingMore(true);
		}
		const fetchLimit = platform === 'mastodon' ? 40 : 100;
		try {
			const response = await api.get(`/${platform}/feed`, {
				params: { limit: fetchLimit, offset },
				withCredentials: true
			});
			//console.log(`${platform} feed response:`, response);
			const items = Array.isArray(response.data?.items) ? response.data.items : [];
			const status = response.data?.status;
			const message = response.data?.message;
			if (!isNextPage && message) {
				setErrorMessage(message);
				setTimeout(() => { setErrorMessage(''); }, 5000);
			}
			if (isNextPage) {
				setPosts(prev => {
					const existingIds = new Set(prev.map(p => p.post_id));
					const newItems = items.filter(item => !existingIds.has(item.post_id));
					return [...prev, ...newItems];
				});
			} else {
				setPosts(items);
			}
			const returnedCount = items.length;
			if (returnedCount === 0) { //May also be because some posts filtered out
				setHasMore(false);
			} else {
				setOffset(prev => prev + returnedCount);
			}
			hasLoadedRef.current = true;
		} catch (error) {
			setErrorMessage('Error getting posts');
		} finally {
			isFetchingRef.current = false;
			setLoading(false);
			setLoadingMore(false);
		}
	}

	const requestDisconnect = () => {
		setModalOpen(true);
	};

	useEffect(() => {
		if (!isAuthenticated) return;
		if (hasLoadedRef.current) return;
		if (justConnected) return;
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		loadFeed();
	}, [refreshTrigger, isAuthenticated, justConnected]);

	useEffect(() => {
		if (hasLoadedRef.current) {
			hasLoadedRef.current = false;
			setOffset(0);
			setHasMore(true);
			setPosts([]);
			setLoading(true);
		}
	}, [platform]);

	useEffect(() => {
		if (!isAuthenticated) return;
		if (hasLoadedRef.current) return;
		try {
			if (justConnected) {
				//console.log("justConnected, checking for cached posts");
				const cacheKey = `${platform}_initial_posts`;
				const cachedPosts = sessionStorage.getItem(cacheKey);
				if (cachedPosts) {
					try {
						const parsedPosts = JSON.parse(cachedPosts);
						//console.log("found cached posts length:", parsedPosts.length);
						setPosts(parsedPosts);
						setOffset(parsedPosts.length);
						setLoading(false);
						hasLoadedRef.current = true;
						sessionStorage.removeItem(cacheKey);
						navigate(location.pathname, { replace: true });
						refreshConnectedAccounts();
						return;
					} catch (error) {
						setErrorMessage('Error getting posts');
						sessionStorage.removeItem(cacheKey);
					}
				}
				refreshConnectedAccounts();
				navigate(location.pathname, { replace: true });
				return;
			}
			loadFeed();
		} catch (error) {
			setErrorMessage('Error loading feed');
			setLoading(false);
		}
	}, [platform, location.search, isAuthenticated, justConnected]);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		const handleScroll = () => {
			if (!hasMore || isFetchingRef.current) return;
			const totalHeight = element.scrollHeight;
			const scrolledDistance = element.scrollTop;
			const visibleHeight = element.clientHeight;
			const distanceRemaining = totalHeight - scrolledDistance - visibleHeight;
			const threshold = window.innerHeight * 1.5;
			if (distanceRemaining <= threshold) {
				loadFeed(true);
			}
		};
		element.addEventListener('scroll', handleScroll);
		return () => {
			element.removeEventListener('scroll', handleScroll);
		};
	}, [hasMore, platform, isAuthenticated, offset]);

	const refreshPosts = () => {
		setErrorMessage('');
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		hasLoadedRef.current = false;
		setRefreshTrigger(prev => !prev);
	};

	document.title = capitalise(platform) + " feed";
	if (!isAuthenticated) {
		return (
			<div className="standard-container">	
				<div className="channel-feed">
					<p className="large-text faded-text">Log in to view your {capitalise(platform)} feed.</p>
				</div>
				<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
					<p className="large-text bold">{platform || "Site not found"}</p>
				</SwipeableAside>
			</div>
		);
	}
	
	return (
		<><div className="standard-container">
			<div ref={scrollRef} className="channel-feed">
				{loading ? (
					<p className="large-text faded-text">Loading {capitalise(platform)} feed...</p>
				) : posts.length === 0 ? (
					<p className="large-text faded-text">No {capitalise(platform)} posts found</p>
				) : (
					<div className="flex flex-col w-99">
						{posts.map((post) => (
							<div key={post.post_id || Math.random()} className="bg-gray-800 rounded-xl">
								<ExternalPostWidget post={post} />
							</div>
						))}
						{loadingMore && (
							<p className="large-text faded-text">Loading more posts...</p>
						)}
						{!hasMore && posts.length > 0 && (
							<p className="large-text faded-text">No more posts to load</p>
						)}
					</div>
				)}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
				<p className="large-text bold">{capitalise(platform) || "Site not found"}</p>
				<p className="small-text faded-text">{errorMessage}</p>
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={platform} refreshPosts={refreshPosts} />
				<p className="tiny-text faded-text">Click to disconnect</p>
				<DisconnectSocialButton socialIcon={`/media/site_images/social_sites/${platform}-logo.png`} socialName={capitalise(platform)} platform={platform} onRequestDisconnect={requestDisconnect} />
			</SwipeableAside>
		</div>
		<ConfirmModal
			isOpen={modalOpen}
			title="Disconnect account"
			message={`Are you sure you want to disconnect your ${capitalise(platform)} account?`}
			onCancel={() => setModalOpen(false)}
			onConfirm={async () => {
				try {
					await api.post('/disconnect_external_account', { platform });
					const existing = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
					const updated = existing.filter(a => a.platform !== platform);
					localStorage.setItem("connectedAccounts", JSON.stringify(updated));
					setModalOpen(false);
					navigate('/explore');
				} catch (error) { }
			}} 
		/></>
	);
}