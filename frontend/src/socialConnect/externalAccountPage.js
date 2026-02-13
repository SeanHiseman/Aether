import api from "../api";
import AlgorithmSelector from "../algorithms/algorithmSelector";
import { AuthContext } from "../components/authContext";
import ExternalPostWidget from "./externalPostWidget";
import { FaExternalLinkAlt } from "react-icons/fa";
import SwipeableAside from "../components/swipeableAside";
import { useContext, useEffect, useState, useRef } from 'react';
import { useParams, useOutletContext, useLocation } from "react-router-dom";

export default function ExternalAccountPage() {
	const { platform, accountId } = useParams();
	const location = useLocation();

	//Check localStorage first for account info (bluesky/mastodon follows are stored on login)
	const getInitialAccountInfo = () => {
		//console.log('[ExternalAccountPage] getInitialAccountInfo called for:', { platform, accountId });
		//First check navigation state
		if (location.state?.accountInfo) {
			//console.log('[ExternalAccountPage] Found account info in navigation state:', location.state.accountInfo);
			return location.state.accountInfo;
		}
		//Then check localStorage for bluesky follows
		if (platform === 'bluesky') {
			try {
				const blueskyFollows = JSON.parse(localStorage.getItem('blueskyFollows') || '[]');
				//console.log('[ExternalAccountPage] Checking localStorage, blueskyFollows count:', blueskyFollows.length);
				const match = blueskyFollows.find(f =>
					f.handle === accountId || f.did === accountId
				);
				if (match) {
					//console.log('[ExternalAccountPage] Found match in localStorage:', { handle: match.handle, did: match.did });
					return {
						did: match.did,
						handle: match.handle,
						display_name: match.display_name,
						avatar: match.avatar,
						description: match.description
					};
				} else {
					console.log('[ExternalAccountPage] No match found in localStorage for accountId:', accountId);
				}
			} catch (error) {
				console.error('[ExternalAccountPage] Error parsing blueskyFollows from localStorage:', error);
			}
		}
		//Then check localStorage for mastodon follows
		if (platform === 'mastodon') {
			try {
				const mastodonFollows = JSON.parse(localStorage.getItem('mastodonFollows') || '[]');
				//console.log('[ExternalAccountPage] Checking localStorage, mastodonFollows count:', mastodonFollows.length);
				const match = mastodonFollows.find(f =>
					f.handle === accountId || f.did === accountId
				);
				if (match) {
					//console.log('[ExternalAccountPage] Found match in localStorage:', { handle: match.handle, did: match.did });
					return {
						did: match.did,
						handle: match.handle,
						display_name: match.display_name,
						avatar: match.avatar,
						description: match.description
					};
				} else {
					console.log('[ExternalAccountPage] No match found in localStorage for accountId:', accountId);
				}
			} catch (error) {
				console.error('[ExternalAccountPage] Error parsing mastodonFollows from localStorage:', error);
			}
		}
		//console.log('[ExternalAccountPage] No initial account info found');
		return null;
	};

	const [accountInfo, setAccountInfo] = useState(getInitialAccountInfo);
	const [errorMessage, setErrorMessage] = useState('');
	const { isAuthenticated } = useContext(AuthContext);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const [posts, setPosts] = useState([]);
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const isFetchingRef = useRef(false);
	const { rightClasses, closeDrawers, mobileOpen } = useOutletContext();
	const scrollRef = useRef(null);
	const hasLoadedRef = useRef(false);
	const previousAccountRef = useRef(`${platform}_${accountId}`);
	const offsetRef = useRef(0);

	const isMobile = () => window.matchMedia("(max-width:768px)").matches;

	const computedRightClasses = [
		rightClasses,
		isMobile() && mobileOpen === "right" ? "open" : ""
	].filter(Boolean).join(" ");

	const capitalise = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

	async function loadPosts(isNextPage = false) {
		//console.log('[ExternalAccountPage] loadPosts called:', { isNextPage, platform, accountId, offset, isAuthenticated });
		if (!isAuthenticated) {
			//console.log('[ExternalAccountPage] Not authenticated, skipping');
			setLoading(false);
			return;
		}
		if (isFetchingRef.current) {
			//console.log('[ExternalAccountPage] Already fetching, skipping');
			return;
		}
		isFetchingRef.current = true;
		if (isNextPage) {
			setLoadingMore(true);
		}
		try {
			//Get fresh account info to avoid using stale state when switching profiles
			const currentAccountInfo = getInitialAccountInfo();
			const url = `/external/${platform}/account/${encodeURIComponent(accountId)}/posts`;
			const currentOffset = isNextPage ? offsetRef.current : 0;
			const params = {
				limit: 50,
				offset: currentOffset,
				//Pass handle and did from fresh accountInfo for better lookup
				...(currentAccountInfo?.handle && { handle: currentAccountInfo.handle }),
				...(currentAccountInfo?.did && { did: currentAccountInfo.did })
			};
			const response = await api.get(url, {
				params,
				withCredentials: true
			});
			const items = Array.isArray(response.data?.items) ? response.data.items : [];
			if (response.data?.accountInfo) {
				setAccountInfo(response.data.accountInfo);
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
			if (returnedCount === 0 || !response.data?.hasMore) {
				setHasMore(false);
			} else {
				offsetRef.current += returnedCount;
				setOffset(offsetRef.current);
			}
			hasLoadedRef.current = true;
		} catch (error) {
			//console.error('[ExternalAccountPage] API error:', error.response?.status, error.response?.data || error.message);
			const message = error.response?.data?.message || 'Error getting posts';
			setErrorMessage(message);
			setTimeout(() => setErrorMessage(''), 5000);
		} finally {
			isFetchingRef.current = false;
			setLoading(false);
			setLoadingMore(false);
		}
	}

	//Detect account change early to prevent showing old posts
	useEffect(() => {
		const currentAccount = `${platform}_${accountId}`;
		if (previousAccountRef.current !== currentAccount) {
			previousAccountRef.current = currentAccount;
			//Clear posts immediately when account changes
			setPosts([]);
			setLoading(true);
		}
	}, [platform, accountId]);

	//Load posts when account changes or on refresh
	useEffect(() => {
		if (!isAuthenticated) return;
		//Reset state for new account
		hasLoadedRef.current = false;
		isFetchingRef.current = false;
		offsetRef.current = 0;
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setAccountInfo(getInitialAccountInfo());
		setLoading(true);
		loadPosts();
	}, [accountId, platform, refreshTrigger, isAuthenticated]);

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
				loadPosts(true);
			}
		};
		element.addEventListener('scroll', handleScroll);
		return () => {
			element.removeEventListener('scroll', handleScroll);
		};
	}, [hasMore, platform, accountId, isAuthenticated]);

	const refreshPosts = () => {
		isFetchingRef.current = false;
		setErrorMessage('');
		offsetRef.current = 0;
		setOffset(0);
		setHasMore(true);
		setPosts([]);
		setLoading(true);
		hasLoadedRef.current = false;
		setRefreshTrigger(prev => prev + 1);
	};

	const getExternalProfileUrl = () => {
		if (platform === 'bluesky') {
			return `https://bsky.app/profile/${accountInfo?.handle || accountId}`;
		}
		return null;
	};

	const displayName = accountInfo?.display_name || accountInfo?.handle || accountId;
	document.title = displayName + " - " + capitalise(platform);

	if (!isAuthenticated) {
		return (
			<div className="standard-container">
				<div className="channel-feed">
					<p className="large-text faded-text">Log in to view this {capitalise(platform)} account.</p>
				</div>
				<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
					<p className="large-text bold">{capitalise(platform)}</p>
				</SwipeableAside>
			</div>
		);
	}

	return (
		<div className="standard-container">
			<div ref={scrollRef} className="channel-feed">
				{loading ? (
					<p className="large-text faded-text">Fetching posts...</p>
				) : posts.length === 0 ? (
					<p className="large-text faded-text">No posts found</p>
				) : (
					<div className="flex flex-col w-99">
						{posts.map((post) => (
							<div key={post?.post_id || Math.random()} className="bg-gray-800 rounded-xl med-mar-bottom">
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
				<div className="feed-summary">
					{accountInfo?.avatar && (
						<img
							className="large-feed-photo"
							src={accountInfo.avatar}
							onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'}
							alt={displayName}
						/>
					)}
					<div className="feed-name">
						<p className="large-text bold">{displayName}</p>
						<img
							className="bluesky-indicator"
							src={`/media/site_images/social_sites/${platform}-logo.png`}
							alt={capitalise(platform)}
							title={capitalise(platform)}
							style={{ width: 20, height: 20 }}
						/>
					</div>
					{accountInfo?.handle && accountInfo?.handle !== displayName && (
						<p className="small-text faded-text">@{accountInfo?.handle}</p>
					)}
					{accountInfo?.description && (
						<p className="description">{accountInfo?.description}</p>
					)}
					{getExternalProfileUrl() && (
						<a
							href={getExternalProfileUrl()}
							target="_blank"
							rel="noopener noreferrer"
							className="small-icon"
							style={{ marginTop: '10px' }}
						>
							<FaExternalLinkAlt />
							<span className="icon-text">View on {capitalise(platform)}</span>
						</a>
					)}
				</div>
				{errorMessage && <p className="small-text faded-text">{errorMessage}</p>}
				<AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={`external_account_${platform}_${accountId}`} refreshPosts={refreshPosts} />
			</SwipeableAside>
		</div>
	);
}