import api from '../../api';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ContentWidget from '../../components/content/contentWidget';
import ExternalPostWidget from '../../socialConnect/externalPostWidget';
import { FaEdit, FaMinus, FaPlus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import SwipeableAside from '../../components/swipeableAside';
import { useCallback, useContext, useEffect, useState, useRef } from 'react';
const FETCH_LIMIT = 50;

const SavedPosts = () => {
	const { channel_name } = useParams();
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const [channels, setChannels] = useState([]);
	const [currentChannelTitle, setCurrentChannelTitle] = useState('');
	const [posts, setPosts] = useState([]);
	const [savedError, setSavedError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [offset, setOffset] = useState(0);
	const [isEditingChannelName, setIsEditingChannelName] = useState(false);
	const [newChannelName, setNewChannelName] = useState('');
	const [showForm, setShowForm] = useState(false);
	const [newChannelInputName, setNewChannelInputName] = useState('');
	const navigate = useNavigate();
	const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext();
	const scrollRef = useRef(null);

	const isMobile = () => window.matchMedia("(max-width:768px)").matches;

    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

	//Fetch channels on mount
	useEffect(() => {
		if (!isAuthenticated) return;
		fetchChannels();
	}, [isAuthenticated]);

	//Navigate to Main channel if no channel selected
	useEffect(() => {
		if (channels.length > 0 && !channel_name) {
			const mainChannel = channels.find(c => c.channel_name === 'Main');
			if (mainChannel) {
				navigate(`/saved/${mainChannel.channel_name}`, { replace: true });
			}
		}
	}, [channels, channel_name, navigate]);

	//Update current channel title when channel changes
	useEffect(() => {
		if (channel_name && channels.length > 0) {
			const currentChannel = channels.find(c => c.channel_name === channel_name);
			if (currentChannel) {
				setCurrentChannelTitle(currentChannel.channel_name);
			}
		}
	}, [channel_name, channels]);

	//Fetch posts when channel changes
	useEffect(() => {
		if (!isAuthenticated || !channel_name) return;
		fetchPosts(true);
	}, [isAuthenticated, channel_name]);

	const fetchChannels = async () => {
		try {
			//Try to load from cache first
			const cached = localStorage.getItem('savedChannels');
			if (cached) {
				try {
					const parsedChannels = JSON.parse(cached);
					setChannels(parsedChannels);
				} catch (e) {
					//Invalid cache, ignore
				}
			}
			//Fetch from server
			const response = await api.get('/get_feed_channels/saved');
			const fetchedChannels = response.data?.channels || [];
			//If no channels exist, create Main channel
			if (fetchedChannels.length === 0) {
				const createResponse = await api.post('/add_feed_channel', {
					channelName: 'Main',
					isSaved: true
				});
				const newChannel = createResponse.data?.newChannel;
				if (newChannel) {
					setChannels([newChannel]);
					localStorage.setItem('savedChannels', JSON.stringify([newChannel]));
				}
			} else {
				setChannels(fetchedChannels);
				localStorage.setItem('savedChannels', JSON.stringify(fetchedChannels));
			}
		} catch (error) {
			setSavedError(error.response?.data?.message || 'Error loading channels');
			setTimeout(() => setSavedError(''), 5000);
		}
	};

	const fetchPosts = useCallback(async (reset = false) => {
		setIsLoading(true);
		setSavedError('');
		try {
			const currentOffset = reset ? 0 : offset;
			const currentChannel = channels.find(c => c.channel_name === channel_name);
			const response = await api.get('/get_saved_posts', {
				params: {
					limit: FETCH_LIMIT,
					offset: currentOffset,
					...(currentChannel && { channelId: currentChannel.channel_id })
				}
			});
			const newPosts = response.data?.posts || [];
			setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
			setOffset(reset ? FETCH_LIMIT : offset + FETCH_LIMIT);
			setHasMore(newPosts.length === FETCH_LIMIT);
		} catch (error) {
			setSavedError(error.response?.data?.message || 'Error loading posts');
			setTimeout(() => setSavedError(''), 5000);
		} finally {
			setIsLoading(false);
		}
	}, [offset, channel_name, channels]);

	const loadMore = useCallback(() => {
		if (!isAuthenticated || isLoading || !hasMore) return;
		fetchPosts(false);
	}, [isAuthenticated, isLoading, hasMore, fetchPosts]);

	const handleScroll = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
			loadMore();
		}
	}, [loadMore]);

	const addChannel = async (event) => {
		event.preventDefault();
		try {
			if (newChannelInputName.length === 0) {
				setSavedError("Channel needs a name");
				setTimeout(() => setSavedError(''), 5000);
				return;
			}
			if (newChannelInputName === 'Main') {
				setSavedError("Channel cannot be named Main");
				setTimeout(() => setSavedError(''), 5000);
				return;
			}
			const { data } = await api.post('/add_feed_channel', {
				channelName: newChannelInputName,
				isSaved: true
			});
			const updatedChannels = [...channels, data.newChannel];
			setChannels(updatedChannels);
			localStorage.setItem('savedChannels', JSON.stringify(updatedChannels));
			navigate(`/saved/${newChannelInputName}`);
			setShowForm(false);
			setNewChannelInputName('');
		} catch (error) {
			setSavedError(error.response.data?.message || 'Error creating channel');
			setTimeout(() => setSavedError(''), 5000);
		}
	};

	const changeChannelName = async (event) => {
		event.preventDefault();
		try {
			if (newChannelName.length === 0) {
				setSavedError("Channel needs a name");
				setTimeout(() => setSavedError(''), 5000);
				return;
			}
			if (newChannelName === 'Main') {
				setSavedError("Channel cannot be named Main");
				setTimeout(() => setSavedError(''), 5000);
				return;
			}
			const currentChannel = channels.find(c => c.channel_name === channel_name);
			const response = await api.post('/change_saved_channel_name', {
				channelId: currentChannel.channel_id,
				newChannelName: newChannelName
			});
			if (response.status === 200) {
				setSavedError('');
				setIsEditingChannelName(false);
				setNewChannelName('');
				const updatedChannels = channels.map(ch =>
					ch.channel_id === currentChannel.channel_id
						? { ...ch, channel_name: newChannelName }
						: ch
				);
				setChannels(updatedChannels);
				localStorage.setItem('savedChannels', JSON.stringify(updatedChannels));
				setCurrentChannelTitle(newChannelName);
				navigate(`/saved/${newChannelName}`);
			}
		} catch (error) {
			setSavedError(error.response.data?.message || "Error changing channel name");
			setTimeout(() => setSavedError(''), 5000);
		}
	};

	const deleteChannel = async () => {
		if (window.confirm(`Are you sure you want to delete ${currentChannelTitle}?`)) {
			try {
				if (currentChannelTitle === 'Main') {
					setSavedError("Main channel cannot be deleted");
					setTimeout(() => setSavedError(''), 5000);
					return;
				}
				const currentChannel = channels.find(c => c.channel_name === channel_name);
				const response = await api.delete('/delete_saved_channel', {
					data: { channelId: currentChannel.channel_id }
				});
				if (response.data?.success) {
					const updatedChannels = channels.filter(ch => ch.channel_id !== currentChannel.channel_id);
					setChannels(updatedChannels);
					localStorage.setItem('savedChannels', JSON.stringify(updatedChannels));
					//Navigate to Main channel
					const mainChannel = channels.find(c => c.channel_name === 'Main');
					if (mainChannel) {
						navigate(`/saved/${mainChannel.channel_name}`);
					}
				}
			} catch (error) {
				setSavedError(error.response.data?.message || 'Error deleting channel');
				setTimeout(() => setSavedError(''), 5000);
			}
		}
	};

	const toggleForm = () => setShowForm(!showForm);

	const currentChannel = channels.find(c => c?.channel_name === channel_name);

	return (
		<div className="standard-container">
			<div ref={scrollRef} onScroll={handleScroll} className="channel-feed">
				{currentChannel ? (
					posts.length > 0 ? (
						<>
							<ul className="content-list">
								{posts.map((post) => (
										post?.is_external ? (
											<div className="med-mar-bottom">
												<ExternalPostWidget
													key={post?.post_id}
													post={post}
													sharedPost={false}
												/>
											</div>
										) : (
											<div className="med-mar-bottom">
												<ContentWidget
													canRemove={false}
													feed={post.parentChannel?.feed}
													isDraft={false}
													isGroup={false}
													key={post.post_id}
													onEditClick={() => {}}
													onPostRemoved={() => {}}
													onReplyClick={() => {}}
													post={post}
												/>
											</div>
										)
								))}
							</ul>
							{isLoading && <p className="large-text faded-text">Loading more posts...</p>}
						</>
					) : (
						!isLoading && <p className="large-text faded-text">No saved posts yet</p>
					)
				) : (
					<p className="large-text faded-text">Select a channel</p>
				)}
			</div>
			<SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
				<div className="feed-summary">
					<p className="large-text">Saved posts</p>
					<div className="channel-name-section">
						{currentChannelTitle !== "Main" ? (
							<>
								{isEditingChannelName ? (
									<div className="change-name">
										<textarea
											className="change-name-area"
											value={newChannelName}
											placeholder="New name"
											onChange={(e) => {
												e.preventDefault();
												const input = e.target.value;
												if (input.length <= 30) {
													setNewChannelName(input);
													setSavedError("");
												} else {
													setSavedError("Name too long");
												}
											}}
										/>
										<div className="cancel-save">
											<button className="small-icon" onClick={() => {setIsEditingChannelName(false); setNewChannelName(""); setSavedError("");}} title="Cancel">
												<FaRegWindowClose />
											</button>
											<button className="small-icon" onClick={(e) => {e.preventDefault(); changeChannelName(e);}} title="Save">
												<FaSave />
											</button>
										</div>
									</div>
								) : (
									<>
										<p className="large-text">{currentChannelTitle}</p>
										<div className="button-group">
											<button className="small-icon" onClick={() => {setIsEditingChannelName(true); setNewChannelName(currentChannelTitle);}} title="Edit channel name">
												<FaEdit />
											</button>
											<button className="small-icon" onClick={deleteChannel} title="Delete channel">
												<FaTrash />
											</button>
											<button className="small-icon" onClick={toggleForm} title={showForm ? "Close" : "Create channel"}>
												{showForm ? <FaMinus /> : <FaPlus />}
											</button>
										</div>
									</>
								)}
							</>
						) : (
							<>
								<p className="large-text">Main</p>
								<div className="button-group">
									<button className="small-icon" onClick={toggleForm} title={showForm ? "Close" : "Create channel"}>
										{showForm ? <FaMinus /> : <FaPlus />}
									</button>
								</div>
							</>
						)}
						{showForm && (
							<div className="change-name" style={{ marginTop: '10px' }}>
								<textarea
									className="change-name-area"
									value={newChannelInputName}
									placeholder="Channel name"
									onChange={(e) => {
										e.preventDefault();
										const input = e.target.value;
										if (input.length <= 30) {
											setNewChannelInputName(input);
											setSavedError("");
										} else {
											setSavedError("Name too long");
										}
									}}
								/>
								<div className="cancel-save">
									<button className="small-icon" onClick={() => {setShowForm(false); setNewChannelInputName(""); setSavedError("");}} title="Cancel">
										<FaRegWindowClose />
									</button>
									<button className="small-icon" onClick={(e) => {e.preventDefault(); addChannel(e);}} title="Save">
										<FaSave />
									</button>
								</div>
							</div>
						)}
						{savedError && <div className="error-message">{savedError}</div>}
					</div>
					<ChannelList
						canReorder={true}
						channels={channels}
						feedId="saved"
						feedName="saved"
						isChat={false}
						isGroup={false}
						isSaved={true}
						setChannels={setChannels}
					/>
				</div>
			</SwipeableAside>
		</div>
	);
};

export default SavedPosts;