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
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

export default function SocialFeedPage({ platform }) {
	const { post_id } = useParams();
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

	async function loadSinglePost() {
		if (!post_id) return;
		try {
			setLoading(true);
			const encodedPostId = encodeURIComponent(post_id); //Handled automatically by express
			const response = await api.get(`/get_external_post/${encodedPostId}`);
			if (response.data?.success && response.data?.post) {
				setPosts([response.data.post]);
				hasLoadedRef.current = true; // Mark as loaded to prevent feed from loading
			} else {
				setErrorMessage('Post not found');
			}
		} catch (error) {
			setErrorMessage('Failed to load post');
		} finally {
			setLoading(false);
		}
	}

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
			//Use hasMore from response, fallback to checking returnedCount
			if (response.data?.hasMore === false || returnedCount === 0) {
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

	// Load single post if post_id is in the URL
	useEffect(() => {
		if (post_id) {
			loadSinglePost();
		}
	}, [post_id]);

	useEffect(() => {
		if (post_id) return; // Skip feed loading if viewing single post
		if (!isAuthenticated) return;
		if (hasLoadedRef.current) return;
		if (justConnected) return;
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		loadFeed();
	}, [refreshTrigger, isAuthenticated, justConnected, platform]);

	useEffect(() => {
		//Always reset state when platform changes
		hasLoadedRef.current = false;
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		isFetchingRef.current = false;
		// Only trigger feed load if not viewing a single post
		if (isAuthenticated && !post_id && !justConnected) {
			loadFeed();
		} else if (post_id) {
			// If viewing single post, load it instead
			loadSinglePost();
		}
	}, [platform]);

	useEffect(() => {
		if (post_id) return; // Skip feed loading if viewing single post
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
		if (post_id) return; // Skip infinite scroll if viewing single post
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

	useEffect(() => {
		if (post_id) return; // Skip refresh if viewing single post
		if (refreshTrigger === 0) return;
		if (!isAuthenticated) return;
		loadFeed();
	}, [refreshTrigger]);

	const refreshPosts = () => {
		isFetchingRef.current = false;
		setErrorMessage('');
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		hasLoadedRef.current = false;
		setRefreshTrigger(prev => prev + 1);
	};

	document.title = capitalise(platform) + " feed";
	
	// When viewing a single post, only show that post
	const displayPosts = post_id && posts.length > 0 ? [posts[0]] : posts;

	return (
		<><div className="standard-container">
			<div ref={scrollRef} className="channel-feed">
				{!post_id && !isAuthenticated ? (
					<p className="large-text faded-text">Log in to view your {capitalise(platform)} feed</p>
				) : loading ? (
					<p className="large-text faded-text">Loading {capitalise(platform)} feed...</p>
				) : displayPosts.length === 0 ? (
					<p className="large-text faded-text">No {capitalise(platform)} posts found</p>
				) : (
					<div className="flex flex-col w-99">
						{displayPosts.map((post) => (
							<div key={post.post_id || Math.random()} className="bg-gray-800 rounded-xl med-mar-bottom">
								<ExternalPostWidget post={post} />
							</div>
						))}
						{!post_id && loadingMore && (
							<p className="large-text faded-text">Loading more posts...</p>
						)}
						{!post_id && !hasMore && displayPosts.length > 0 && (
							<p className="large-text faded-text">No more posts to load</p>
						)}
					</div>
				)}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
				<p className="large-text bold">{capitalise(platform) || "Site not found"}</p>
				<p className="small-text faded-text">{errorMessage}</p>
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={platform} refreshPosts={refreshPosts} />
				{isAuthenticated && <p className="tiny-text faded-text">Click to disconnect</p>}
				{isAuthenticated && <DisconnectSocialButton socialIcon={`/media/site_images/social_sites/${platform}-logo.png`} socialName={capitalise(platform)} platform={platform} onRequestDisconnect={requestDisconnect} />}
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