import AlgorithmSelector from '../../algorithms/algorithmSelector';
import api from '../../api';
import { AuthContext } from '../../components/authContext';
import ChannelList from '../../components/channels/channelList';
import ChatChannel from '../../components/channels/chatChannel';
import ConfirmModal from '../../components/modals/confirmModal';
import ContentForm from '../../components/content/contentForm';
import { FaCog, FaEdit, FaFilter, FaFolder, FaFolderOpen, FaMinus, FaPlus, FaRegWindowClose, FaPen, FaReply, FaRetweet, FaSave, FaTrash, FaUser, FaUsers } from 'react-icons/fa';
import { FormatNumber } from '../../functions/formatNumber';
import FollowerChangeButton from '../../components/followerChangeButton';
import { hasUnreadMessages } from '../../functions/channelViewTracking';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import ManageConnectionButton from '../../components/messages/manageConnectionButton';
import PostChannel from '../../components/channels/postChannel';
import SwipeableAside from '../../components/swipeableAside';
import { useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ValidateTextInput } from '../../functions/validateTextInput';

const FeedHome = () => {
    const [canRemove, setCanRemove] = useState(false);
    const [channelMode, setChannelMode] = useState('post');
    const [channels, setChannels] = useState([]);
    const [channelSettingsDropdownOpen, setChannelSettingsDropdownOpen] = useState(false);
    const [draftPosts, setDraftPosts] = useState([]);
    const [feed, setFeed] = useState('');
    const [feedErrorMessage, setFeedErrorMessage] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
    const [includeGroup, setIncludeGroup] = useState(true);
    const [includeReplies, setIncludeReplies] = useState(true);
    const [includeReposts, setIncludeReposts] = useState(true);
    const [includeUser, setIncludeUser] = useState(true);
    const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [isEditingChannelName, setIsEditingChannelName] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [isNewNameValid, setIsNewNameValid] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [newChannelName, setNewChannelName] = useState('');
    const [parentPostForEdit, setParentPostForEdit] = useState(null);
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [postToEdit, setPostToEdit] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [replyingToPost, setReplyingToPost] = useState(null);
    const { rightClasses, updateFeeds, closeDrawers, mobileOpen } = useOutletContext();
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [pendingDeleteAction, setPendingDeleteAction] = useState(null)
    const [showMobileHeader, setShowMobileHeader] = useState(true);
    const lastScrollY = useRef(0);
    const channelFeedRef = useRef(null);
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const location = useLocation();
    const { feed_name, channel_name, post_id } = useParams();
    const isChatMode = location.pathname.endsWith('/chat');
    const isCreateMode = location.pathname.endsWith('/create');
    const isEditMode = location.pathname.endsWith('/edit');
    const isReplyMode = location.pathname.endsWith('/reply');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const showDrafts = location.pathname.endsWith('/drafts');
    const isViewingSelf = viewer?.feed_name === feed_name;
    const urlPrefix = feed?.is_group ? 'g' : 'u';

    const [channelViewTrigger, setChannelViewTrigger] = useState(0);

    const isMobile = () => window.matchMedia("(max-width:768px)").matches;

    const computedRightClasses = [
        rightClasses,
        isMobile() && mobileOpen === "right" ? "open" : ""
    ].filter(Boolean).join(" ");

    //Handle scroll behavior for mobile header
    useEffect(() => {
        if (!isMobile()) return;

        //Find the channel-feed element
        const channelFeed = document.querySelector('.channel-feed');
        if (!channelFeed) return;

        channelFeedRef.current = channelFeed;

        const handleScroll = (e) => {
            const currentScrollY = e.target.scrollTop;

            //Show header when scrolling up or at the top
            if (currentScrollY < lastScrollY.current || currentScrollY < 10) {
                setShowMobileHeader(true);
            }
            //Hide header when scrolling down (and not at the top)
            else if (currentScrollY > lastScrollY.current && currentScrollY > 10) {
                setShowMobileHeader(false);
            }

            lastScrollY.current = currentScrollY;
        };

        channelFeed.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            if (channelFeedRef.current) {
                channelFeedRef.current.removeEventListener('scroll', handleScroll);
            }
        };
    }, [loading, feed_name, channel_name]);

    //Show mobile header when sidebar closes
    useEffect(() => {
        if (isMobile() && mobileOpen !== "right") {
            setShowMobileHeader(true);
        }
    }, [mobileOpen]);

    useEffect(() => {
        const fetchFeedData = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/feed/${feed_name}`);
                const fetchedFeed = response.data?.feedResult;
                setIsAdmin(fetchedFeed?.isAdmin);
                setIsModerator(fetchedFeed?.isMod);
                setIsLocked(fetchedFeed?.is_locked);
                if (viewer?.feed_id === fetchedFeed?.feed_id) {
                    setIsAdmin(true);
                    setIsModerator(true);
                }
                setFeed(fetchedFeed);
                setFeedNotFound(false);
            } catch (error) {
                if (error.response && error.response?.status === 404) {
                    setFeedNotFound(true);
                } else {
                    setFeedErrorMessage(error.response?.data?.message || 'Failed to load feed');
                    setTimeout(() => { setFeedErrorMessage('') }, 3000);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchFeedData();
    }, [feed_name, viewer]);

    //Moderators and admins can remove content
    useEffect(() => {
        if (isAdmin || isModerator) {
            setCanRemove(true);
        };
    }, [isAdmin, isModerator]);

    useEffect(() => {
        if (showDrafts && channelRender) {
            const fetchDrafts = async () => {
                try {
                    const response = await api.get('/get_post_drafts', {
                        params: { channel_id: channelRender?.channel_id, poster_id: viewer?.feed_id }
                    })
                    setDraftPosts(response.data?.drafts)
                } catch (error) {
                    setFeedErrorMessage(error.response?.data?.message || "Error getting drafts");
                }
            }
            fetchDrafts()
        }
    }, [showDrafts, channel_name])

    useEffect(() => {
        if (!showDrafts) {
            setDraftPosts([]);
        }
    }, [feed_name, channel_name, showDrafts]);

    useEffect(() => {
        if (isEditMode && post_id) {
            const editData = location.state?.editData;
            const parentPost = location.state?.parentPost;
            if (editData) {
                setShowPostForm(true);
                setIsEdit(true);
                setPostToEdit(editData);
                setParentPostForEdit(parentPost || null); 
                return;
            }
            const fetchPost = async () => {
                const isDraftPath = location.pathname.includes('/drafts/');
                if (isDraftPath) {
                    const draft = draftPosts.find(d => d?.draft_id === post_id);
                    if (draft) {
                        setShowPostForm(true);
                        setIsEdit(true);
                        setPostToEdit(draft);
                        setParentPostForEdit(parentPost || null);
                        return;
                    }
                }
                let cachedPost = queryClient.getQueryData(['singlePost', post_id]);
                if (cachedPost) {
                    setShowPostForm(true);
                    setIsEdit(true);
                    setPostToEdit(cachedPost);
                    return;
                }
                try {
                    const response = await api.get('/channel_posts', { 
                        params: { isSingle: true, feedId: feed?.feed_id, postId: post_id } 
                    });
                    const post = response.data?.post;
                    if (post) {
                        queryClient.setQueryData(['singlePost', post_id], post);
                        setShowPostForm(true);
                        setIsEdit(true);
                        setPostToEdit(post);
                    }
                } catch (error) {
                    setPostErrorMessage(error.response?.data?.message || "Error fetching post to edit");
                }
            };
            fetchPost();
        }
        else if (!isEditMode) {
            setShowPostForm(false);
            setIsEdit(false);
            setPostToEdit(null);
            setParentPostForEdit(null);
        }
    }, [isEditMode, post_id, queryClient, location.state, draftPosts]);

    useEffect(() => {
        if (!isReplyMode || !post_id) {
            setReplyingToPost(null);
            return;
        }
        const statePost = location.state?.replyingTo;
        if (statePost) {
            setReplyingToPost(statePost);
            queryClient.setQueryData(['singlePost', post_id], statePost);
            return;
        }
        //Redundant backups, should work just from statePost
        const cachedPost = queryClient.getQueryData(['singlePost', post_id]);
        if (cachedPost) {
            setReplyingToPost(cachedPost);
            return;
        }
        const fetchPost = async () => {
            try {
                const response = await api.get('/channel_posts', {
                    params: { isSingle: true, feedId: feed?.feed_id, postId: post_id },
                });
                const post = response.data?.post;
                if (post) {
                    queryClient.setQueryData(['singlePost', post_id], post);
                    setReplyingToPost(post);
                } else {
                    setReplyingToPost({ error: true });
                }
            } catch (error) {
                setReplyingToPost({ error: true });
            }
        };
        fetchPost();
    }, [isReplyMode, post_id, feed?.feed_id, queryClient, location.state]);

    //Reset user/group/repost filters when not on Main channel
    useEffect(() => {
        if (channel_name !== 'Main') {
            setIncludeUser(true);
            setIncludeGroup(true);
            setIncludeReposts(true);
        }
    }, [channel_name]);

    //Set channel mode based on URL
    useEffect(() => {
        const currentChannel = channels.find(c => c?.channel_name === channel_name);
        if (currentChannel) {
            //Check URL first - if it ends with /chat, set to chat mode
            if (isChatMode && currentChannel.is_chat) {
                setChannelMode('chat');
            } else if (currentChannel.is_posts) {
                //Default to 'post' if channel has posts
                setChannelMode('post');
            } else if (currentChannel.is_chat) {
                //Fall back to 'chat' if channel only has chat
                setChannelMode('chat');
            }
        }
    }, [channel_name, channels, isChatMode]);

    //Update localStorage cache when channels change
    useEffect(() => {
        if (feed?.feed_id && channels.length > 0) {
            localStorage.setItem(`feedChannels_${feed.feed_id}`, JSON.stringify(channels));
        }
    }, [channels, feed?.feed_id]);

    //Listen for new messages to trigger re-render for unread indicators
    useEffect(() => {
        const socket = window.socket;
        if (!socket || !feed?.is_group) return;

        const handleNewMessage = (newMessage) => {
            const currentChannelId = channels.find(c => c?.channel_name === channel_name)?.channel_id;
            const messageChannel = channels.find(c => c?.channel_id === newMessage.channel_id);

            //Only update for chat-enabled channels and if message is in a different channel
            if (newMessage.channel_id &&
                newMessage.channel_id !== currentChannelId &&
                messageChannel?.is_chat) {
                //Update the channel's updated_at timestamp and trigger re-render
                //ChannelList will recalculate hasUnread from localStorage
                setChannels(prevChannels => {
                    const updatedChannels = prevChannels.map(c =>
                        c?.channel_id === newMessage.channel_id
                            ? { ...c, updated_at: new Date().toISOString() }
                            : c
                    );
                    // Update localStorage cache for unread indicator
                    if (feed?.feed_id) {
                        localStorage.setItem(`feedChannels_${feed.feed_id}`, JSON.stringify(updatedChannels));
                        // Notify feedItems to update their unread indicators
                        window.dispatchEvent(new CustomEvent('channelsUpdated', {
                            detail: { feedId: feed.feed_id }
                        }));
                    }
                    return updatedChannels;
                });
            }
        };

        socket.on('channel_message_confirmed', handleNewMessage);

        return () => {
            socket.off('channel_message_confirmed', handleNewMessage);
        };
    }, [channel_name, channels, feed?.is_group]);

    //Re-render when a channel is marked as read for instant unread dot updates
    useEffect(() => {
        const handleChannelViewed = () => setChannelViewTrigger(prev => prev + 1);
        window.addEventListener('channelViewed', handleChannelViewed);
        return () => window.removeEventListener('channelViewed', handleChannelViewed);
    }, []);

    const AddChannel = async (event) => {
        if (!isAuthenticated) return;
        event.preventDefault();
        try {
            const baseName = "New channel";
            let finalChannelName = "";
            if (newChannelName.length === 0) {
                if (!channels.some(channel => channel?.channel_name === baseName)) {
                    finalChannelName = baseName;
                } else {
                    let counter = 2;
                while (channels.some(channel => channel?.channel_name === `${baseName} ${counter}`)) {
                    counter++;
                }
                finalChannelName = `${baseName} ${counter}`;
                }
            } else {
                finalChannelName = newChannelName;
                if (channels.some(channel => channel?.channel_name === finalChannelName)) {
                    setFeedErrorMessage("Name already used");
                    setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                    return;
                }
            }
            const response = await api.post('/add_feed_channel', {
                channelName: finalChannelName,
                feedId: feed?.feed_id,
                isChat: feed?.is_group ? isChatChannel : false,
                isPosts: feed?.is_group ? isPostChannel : true
            });
            if (response.data && response.status === 201) {
                const newChannel = response.data?.newChannel;
                const updatedChannels = [newChannel, ...channels];
                setChannels(updatedChannels);
                setFeedErrorMessage('');
                setNewChannelName('');
                setShowChannelForm(false);
                navigate(`/${urlPrefix}/${feed_name}/${finalChannelName}`);
            } else {
                setFeedErrorMessage(response.data?.message || 'Failed to add channel');
                setTimeout(() => { setFeedErrorMessage(''); }, 5000);
            }
        } catch (error) {
            setFeedErrorMessage(error.response?.data?.message || 'Failed to add channel');
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };
    
    const channelRender = channels.find(c => c?.channel_name === channel_name);

    // eslint-disable-next-line no-unused-vars
    const currentChannelHasUnreadChat = channelViewTrigger >= 0 && channelRender?.is_chat
        && hasUnreadMessages(channelRender?.channel_id, channelRender?.updated_at, true);

    useEffect(() => {
        if (!channelRender && channels.length > 0 && channel_name !== 'Main') {
            //Channel doesn't exist, redirect to Main and clean up localStorage
            setFeedErrorMessage('Channel not found. Redirecting to Main channel...');
            //Remove the deleted channel from localStorage cache
            if (feed?.feed_id) {
                const cachedChannels = localStorage.getItem(`feedChannels_${feed.feed_id}`);
                if (cachedChannels) {
                    try {
                        const parsedChannels = JSON.parse(cachedChannels);
                        const updatedChannels = parsedChannels.filter(c => c?.channel_name !== channel_name);
                        localStorage.setItem(`feedChannels_${feed.feed_id}`, JSON.stringify(updatedChannels));
                    } catch (error) {
                        console.error('Error updating cached channels:', error);
                    }
                }
            }
            //Redirect to Main channel
            setTimeout(() => {
                navigate(`/${urlPrefix}/${feed_name}/Main`);
            }, 1500);
        } else if (!channelRender && channels.length > 0 && channel_name === 'Main') {
            setFeedErrorMessage('Channel not found. Please check the url.');
        } else {
            setFeedErrorMessage('');
        }
    }, [channelRender, channels, channel_name, feed?.feed_id, feed_name, navigate, urlPrefix]);

    //Auto open contentForm when /create is on the end of the url
    useEffect(() => {
        if (isCreateMode && channelRender) {
            setIsEdit(false);
            setPostToEdit(null);
            setShowPostForm(true);
        }
    }, [isCreateMode, channelRender]);

    const changeChannelName = async (event) => {
        if (!isAuthenticated) return;
        event.preventDefault();
        try {
            const channelId = channelRender?.channel_id;
            const response = await api.post('/change_channel_name', {
                channelId,
                newChannelName
            });
            if (response.status === 200) {
                setFeedErrorMessage('');
                setIsEditingChannelName(false);
                setNewChannelName('');
                setChannels(prevChannels => 
                    prevChannels.map(channel =>
                        channel?.channel_id === channelId ? {...channel, channel_name: newChannelName} : channel
                    )
                );
                navigate(`/${urlPrefix}/${feed_name}/${newChannelName}`);
            } else {
                setFeedErrorMessage(response.data?.message || 'Error changing channel name');
                setTimeout(() => { setFeedErrorMessage(''); }, 5000);
            }
        } catch (error) {
            setFeedErrorMessage(error.response?.data?.message || "Error changing channel name");
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };

    const cancelDelete = () => {
		setShowDeleteConfirm(false);
		setPendingDeleteAction(null);
	};

	const deleteClick = () => {;
		setPendingDeleteAction(channel_name);
		setShowDeleteConfirm(true);
	};

    const deleteChannel = async () => {
        if (!isAuthenticated) return;
        setShowDeleteConfirm(false);
        try {
            if (channel_name === 'Main') {
                setFeedErrorMessage("Main chat cannot be deleted.");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                return;
            }
            const channelId = channelRender?.channel_id;
            const response = await api.delete('/delete_feed_channel', { data: { channelId } });
            if (response.data?.success) {
                setChannels(prevChannels => prevChannels.filter(channel => channel?.channel_id !== channelId));
                navigate(`/${urlPrefix}/${feed_name}/Main`);
            }
        } catch (error) {
            setFeedErrorMessage(error.response?.data?.response || 'Error deleting channel');
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
        setPendingDeleteAction(null);
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

    //Could move to contentForm
    const postSubmit = async (formData) => {
        if (!isAuthenticated) return;
        if (!formData) {
            setPostErrorMessage("Post cannot be empty");
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            return;
        }
        try {
            formData.append('poster_id', viewer?.feed_id);
            const boostAmount = user?.has_membership ? 2 : 1; //Premium members get 2x boost
            formData.append('boost_amount', boostAmount);
            const response = await api.post('/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const postId = response.data?.result?.post_id;
            const parentId = response.data?.result?.parent_id; //If post is a reply
            const navId = parentId ? parentId : postId; //Navigate to parent if reply
            const navigationUrl = `/${urlPrefix}/${feed_name}/${channel_name}/${navId}`;
            setShowPostForm(false);
            setReplyingToPost(null);  
            setPostToEdit(null);     
            setIsEdit(false); 
            navigate(navigationUrl);
        } catch (error) {
            if (error.response?.status === 413) {
                setPostErrorMessage(error.response?.data?.message + (!user?.has_membership ? ". Get membership for more" : ""));
                setTimeout(() => { setFeedErrorMessage(''); }, 10000); //Longer timeout for membership message
            } else {
                setPostErrorMessage(error.response?.data?.message || "Error creating post");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            }
        }
    };

    const refreshPosts = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const toggleDrafts = () => {
        if (showDrafts) {
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
        } else {
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}/drafts`);
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => {
        setShowChannelForm((prev) => {
            if (!prev && feed?.is_group) {
                //Reset to both post and chat when opening form for group feeds
                setIsPostChannel(true);
                setIsChatChannel(true);
            }
            return !prev;
        });
    };

    //Decides contents of feed
    const renderContentForm = (isReply = false) => {
        const isEditingReply = isEdit && postToEdit?.parent_id != null;
        const effectiveIsReply = isReply || isEditingReply;
        return (
            <ContentForm 
                channelId={channelRender?.channel_id} 
                feed={feed} 
                isEdit={isEdit}
                isGroup={feed?.is_group}
                isReply={effectiveIsReply} 
                onPostDelete={() => {
                    setShowPostForm(false);
                    setIsEdit(false);
                    setPostToEdit(null);
                    setReplyingToPost(null);
                    setParentPostForEdit(null);
                    navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
                }}
                onPostSubmit={postSubmit}
                parentPost={isEditingReply ? parentPostForEdit : null}
                populateFromPost={isEdit}
                post={isReply && !isEdit ? replyingToPost : postToEdit}
                postErrorMessage={postErrorMessage} 
                setPostErrorMessage={setPostErrorMessage} 
                setShowForm={effectiveIsReply ? () => {
                    setReplyingToPost(null);
                    setPostToEdit(null);
                    setParentPostForEdit(null);
                    setIsEdit(false);
                    const navId = isEditingReply ? postToEdit?.parent_id : replyingToPost?.post_id;
                    navigate(`/${urlPrefix}/${feed_name}/${channel_name}${navId ? `/${navId}` : ''}`);
                } : () => {
                    setShowPostForm(false);
                    setIsEdit(false);
                    setPostToEdit(null);
                    setParentPostForEdit(null);
                    if (isEditMode && post_id) {
                        const isDraftEdit = location.state?.isDraft || postToEdit?.draft_id;
                        if (isDraftEdit) {
                            navigate(`/${urlPrefix}/${feed_name}/${channel_name}/drafts`);
                        } else {
                            navigate(`/${urlPrefix}/${feed_name}/${channel_name}/${post_id}`);
                        }
                    } else {
                        navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
                    }
                }}
            />
        );
    };
    const renderPostChannel = (isDraft = false) => (
        <PostChannel
            channelId={channelRender?.channel_id}
            channelName={isDraft ? channel_name : channelRender?.channel_name}
            feed={feed}
            includeGroup={includeGroup}
            includeReplies={includeReplies}
            includeReposts={includeReposts}
            includeUser={includeUser}
            isDraft={isDraft}
            isEditMode={isEditMode}
            isGroup={feed?.is_group}
            refreshTrigger={isDraft ? undefined : refreshTrigger}
            setFeedErrorMessage={setFeedErrorMessage}
        />
    );
    const renderChannelContent = () => {
        if (isEditMode && showPostForm) return renderContentForm(false);
        if (isReplyMode) {
            renderPostChannel(false);
            return renderContentForm(true);
        }
        if (showDrafts) return renderPostChannel(true);
        if (replyingToPost) return renderContentForm(true);
        if (showPostForm) return renderContentForm(false);
        if (!channelRender) return null;
        const isPostMode = channelRender?.is_posts && (channelMode === 'post' || !channelRender?.is_chat);
        return isPostMode ? renderPostChannel(false) : (
            <ChatChannel
                canAdd={isAdmin}
                canRemove={canRemove}
                channelId={channelRender?.channel_id}
                feedId={feed?.feed_id}
                isGroup={true}
                isLocked={isLocked}
                setErrorMessage={setFeedErrorMessage}
            />
        );
    };

    //Checks following if feed is private
    const privateNoView = feed?.type === 'private' && !feed?.isFollower && !feed?.isConnected;
    document.title = feed?.feed_name || 'Feed not found';

    if (feedNotFound) {
        return (
            <div className="standard-container"> 
                <div className="channel-feed">            
                    <div className="large-text faded-text">Feed not found</div>
                </div>
                <aside className="right-aside"/>
            </div>
        );
    } 
    if (privateNoView) {
        return (
            <div className="standard-container">
                <div className="channel-feed">
                    <p className="large-text faded-text">This feed is private</p>
                </div>
                <SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
                    <div id="feed-summary">
                        <img className="large-feed-photo" src={`${feed?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                        <p className="large-text bold">{feed?.feed_name}</p>
                        <p className="description" >{feed?.description}</p>
                        {viewer && isAuthenticated && (
                            <FollowerChangeButton feed={feed} showVertical={true} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
                        )}
                        {!isViewingSelf && !feed?.is_group && isAuthenticated && (
                            <ManageConnectionButton feed={feed} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
                        )}
                    </div>
                </SwipeableAside>
            </div>
        );
    }
    return (
        <>
            {/* Mobile Header */}
            {!loading && isMobile() && mobileOpen !== "right" && (
                <div className={`mobile-feed-header ${showMobileHeader ? 'visible' : 'hidden'}`}>
                    <Link to={`/${urlPrefix}/${feed_name}/Main`} className="feed-link">
                        <img
                            className="medium-feed-photo"
                            src={`${feed?.feed_photo}`}
                            onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'}
                            alt={feed?.feed_name}
                        />
                        <div className="mobile-header-info">
                            <p className="feed-list-text">{feed?.feed_name}</p>
                            <p className="small-text faded-text">{feed?.is_group ? 'Group' : 'User'}</p>
                        </div>
                    </Link>
                    {feed && user?.user_id !== feed?.feed_owner && isAuthenticated && viewer ? (
                        <FollowerChangeButton
                            feed={feed}
                            showFollowers={false}
                            showName={false}
                            showVertical={false}
                            updateFeeds={updateFeeds}
                            viewerId={viewer?.feed_id}
                        />
                    ) : (
                        <p className="icon-text">{FormatNumber(feed?.follower_count)} {(feed?.follower_count) === 1 ? 'follower' : 'followers'}</p>
                    )}
                    {!isViewingSelf && !feed?.is_group && isAuthenticated && (
                        <ManageConnectionButton
                            feed={feed}
                            viewerId={viewer?.feed_id}
                            updateFeeds={updateFeeds}
                        />
                    )}
                </div>
            )}
            <div className={`standard-container ${isMobile() && mobileOpen !== "right" && !loading ? 'has-mobile-header' : ''}`}>
            {renderChannelContent()}
            {!loading ? (
                <SwipeableAside className={computedRightClasses} position="right" isOpen={mobileOpen === "right"} onClose={closeDrawers}>
                    <div className="feed-summary">
                        <Link to={`/${urlPrefix}/${feed_name}/Main`}>
                            <img className="large-feed-photo" src={`${feed?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                        </Link>
                        <div className="feed-name">
                            <Link to={`/${urlPrefix}/${feed_name}/Main`}>
                                <p className="large-text bold">{feed?.feed_name}</p>
                            </Link>
                            {(isModerator || isAdmin) && (
                                <Link to={`/settings/${feed_name}`}>
                                    <button className="small-icon" title="Settings">
                                        <FaCog />
                                    </button>
                                </Link>
                            )}
                        </div>
                        <p className="small-text faded-text">{feed?.is_group ? 'Group' : 'User'} | {FormatNumber(feed?.post_count)} {(feed?.post_count) === 1 ? 'post' : 'posts'}</p>
                        <p className="description">{feed?.description}</p>
                        {feed && user?.user_id !== feed?.feed_owner && isAuthenticated && viewer ? (
                            <FollowerChangeButton feed={feed} showName={false} showVertical={true} updateFeeds={updateFeeds} viewerId={viewer?.feed_id} />
                        ) : (
                            <p className="icon-text">{FormatNumber(feed?.follower_count)} {(feed?.follower_count) === 1 ? 'follower' : 'followers'}</p>
                        )}
                        {!isViewingSelf && !feed?.is_group && isAuthenticated && (
                            <ManageConnectionButton feed={feed} viewerId={viewer?.feed_id} updateFeeds={updateFeeds} />
                        )}
                    </div>
                    {feedErrorMessage && <div className="small-text faded-text">{feedErrorMessage}</div>}
                    {channelRender && (
                        <div className="channel-name-section">
                            <Link to={`/${urlPrefix}/${feed_name}/${channel_name}`} className="channel-header-text" style={{ margin: 0, width: '100%' }}>
                                {channel_name}
                            </Link>
                            {isEditingChannelName ? (
                                <div className="change-name">
                                    <textarea
                                        className="change-name-area"
                                        onChange={(e) => {
                                            const input = e.target.value;
                                            if (input.length <= 30) {
                                                setNewChannelName(input);
                                                if (input) {
                                                    if (input.trim() === 'main') {
                                                        setFeedErrorMessage("Cannot be named 'Main'");
                                                    } else {
                                                        const result = ValidateTextInput(input, 1, 30);
                                                        if (result.valid) {
                                                            setFeedErrorMessage("");
                                                            setIsNewNameValid(true);
                                                        } else {
                                                            setFeedErrorMessage(result.error);
                                                            setIsNewNameValid(false);
                                                        }
                                                    }
                                                } else {
                                                    setFeedErrorMessage("");
                                                    setIsNewNameValid(false);
                                                }
                                            } else {
                                                setFeedErrorMessage("No more than 30 characters");
                                                setIsNewNameValid(false);
                                            }
                                        } }
                                        placeholder="New name"
                                        value={newChannelName} />
                                    <div className="cancel-save">
                                        <button className="small-icon" onClick={() => { setIsEditingChannelName(false); setNewChannelName(""); setFeedErrorMessage(""); } } title="Cancel">
                                            <FaRegWindowClose />
                                        </button>
                                        <button className={!isNewNameValid ? "small-icon disabled" : "small-icon"} onClick={changeChannelName} title="Save">
                                            <FaSave />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="channel-name">
                                    <div className="feed-name">
                                        {isAdmin && channel_name !== 'Main' && <Link to={`/${urlPrefix}/${feed_name}/${channel_name}`}>
                                            <p className="medium-text">{channel_name}</p>
                                        </Link>}
                                        {channel_name !== "Main" && isAdmin && (
                                            <div className="dropdown" style={{ position: 'relative' }}>
                                                <button className="small-icon" type="button" onClick={() => setChannelSettingsDropdownOpen(!channelSettingsDropdownOpen)} title="Channel settings">
                                                    <FaCog />
                                                </button>
                                                {channelSettingsDropdownOpen && (
                                                    <div className="dropdown-menu" style={{ position: 'absolute', zIndex: 100, left: '50%', top: '100%', transform: 'translateX(-67%)' }}>
                                                        <button
                                                            className="small-icon"
                                                            type="button"
                                                            onClick={() => {
                                                                setChannelSettingsDropdownOpen(false);
                                                                setIsEditingChannelName(true);
                                                                setNewChannelName(channel_name);
                                                            }}
                                                        >
                                                            <FaEdit /><span className="icon-text">Edit name</span>
                                                        </button>
                                                        <button
                                                            className="small-icon"
                                                            type="button"
                                                            onClick={() => {
                                                                setChannelSettingsDropdownOpen(false);
                                                                deleteClick();
                                                            }}
                                                        >
                                                            <FaTrash /><span className="icon-text">Delete channel</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {isAdmin && (
                                        <button className="small-icon" onClick={toggleChannelForm} title={showChannelForm ? 'Close' : 'Create Channel'}>
                                            {showChannelForm ? <FaMinus /> : <FaPlus />}<p className="icon-text">{showChannelForm ? "Close" : "New channel"}</p>
                                        </button>
                                    )}
                                    {(showPostForm || showDrafts) && (
                                        <button className="small-icon" onClick={toggleDrafts} title={showDrafts ? 'Hide Drafts' : 'Show Drafts'}>
                                            {showDrafts ? <FaFolder /> : <FaFolderOpen />}<p className="icon-text">{showDrafts ? "Hide drafts" : "Drafts"}</p>
                                        </button>
                                    )}
                                    {showChannelForm && (
                                        <form className="add-channel-form" onSubmit={AddChannel}>
                                            <input
                                                className="name-input"
                                                onChange={(e) => {
                                                    const input = e.target.value;
                                                    if (input.length <= 30) {
                                                        setNewChannelName(input);
                                                        if (input) {
                                                            if (input.trim() === 'main') {
                                                                setFeedErrorMessage("Cannot be named 'Main'");
                                                            } else {
                                                                const result = ValidateTextInput(input, 1, 30);
                                                                if (result.valid) {
                                                                    setFeedErrorMessage("");
                                                                    setIsNewNameValid(true);
                                                                } else {
                                                                    setFeedErrorMessage(result.error);
                                                                    setIsNewNameValid(false);
                                                                }
                                                            }
                                                        } else {
                                                            setFeedErrorMessage("");
                                                            setIsNewNameValid(false);
                                                        }
                                                    } else {
                                                        setFeedErrorMessage("No more than 30 characters");
                                                        setIsNewNameValid(false);
                                                    }
                                                }}
                                                placeholder="Channel name..."
                                                type="text"
                                                value={newChannelName} />
                                            {feed.is_group && (
                                                <div className="channel-options">
                                                    <label>
                                                        <input checked={isPostChannel} onChange={handlePostClick} type="checkbox"/>
                                                        Post Channel
                                                    </label>
                                                    <label>
                                                        <input checked={isChatChannel} onChange={handleChatClick} type="checkbox"/>
                                                        Chat Channel
                                                    </label>
                                                </div>
                                            )}
                                            <button className="small-icon" title="Create channel" type="submit">
                                                <FaPlus /><p className="icon-text">Create channel</p>
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {channelMode === 'post' && !showPostForm && !showDrafts && (feed?.is_group || feed?.feed_owner === user?.user_id) && (!isLocked || isAdmin) && isAuthenticated && (
                        <button
                            className="main-button"
                            onClick={() => {
                                setIsEdit(false);
                                setPostToEdit(null);
                                setShowPostForm(true);
                            } }
                            title="Create Post"
                        >
                            <FaPen /><p className="icon-text">Create post</p>
                        </button>
                    )}
                    <AlgorithmSelector display={false} isAuthenticated={isAuthenticated} locationId={channelRender?.channel_id} refreshPosts={refreshPosts} />
                    {channel_name === 'Main' && !feed.is_group && (
                        <div className="dropdown" style={{ position: 'relative' }}>
                            <button className="small-icon" onClick={() => setShowFiltersDropdown(!showFiltersDropdown)} title="Filters">
                                <FaFilter />
                                <p className="icon-text">Filters</p>
                            </button>
                            {showFiltersDropdown && (
                                <div className="dropdown-menu" style={{ left: '-50%' }}>
                                    <button onClick={() => setIncludeUser(!includeUser)} className="small-icon">
                                        <FaUser />
                                        <p className="icon-text">
                                            {includeUser ? "Hide user posts" : "Show user posts"}
                                        </p>
                                    </button>
                                    <button onClick={() => setIncludeGroup(!includeGroup)} className="small-icon">
                                        <FaUsers />
                                        <p className="icon-text">
                                            {includeGroup ? "Hide group posts" : "Show group posts"}
                                        </p>
                                    </button>
                                    <button onClick={() => setIncludeReposts(!includeReposts)} className="small-icon">
                                        <FaRetweet />
                                        <p className="icon-text">
                                            {includeReposts ? "Hide reposts" : "Show reposts"}
                                        </p>
                                    </button>
                                    <button onClick={() => setIncludeReplies(!includeReplies)} className="small-icon">
                                        <FaReply />
                                        <p className="icon-text">
                                            {includeReplies ? "Hide replies" : "Show replies"}
                                        </p>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {channelRender && channelRender.is_posts && channelRender.is_chat && (
                        <div className="option-toggle">
                            <button
                                className={channelMode === 'post' ? 'active-mode' : 'passive-mode'}
                                onClick={() => navigate(`/${urlPrefix}/${feed_name}/${channel_name}`)}
                            >
                                Posts
                            </button>
                            <button
                                className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'}
                                onClick={() => navigate(`/${urlPrefix}/${feed_name}/${channel_name}/chat`)}
                            >
                                Chat
                                {currentChannelHasUnreadChat && channelMode !== 'chat' && (
                                    <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '20px', marginLeft: '4px' }}>•</span>
                                )}
                            </button>
                        </div>
                    )}
                    <ChannelList canReorder={isAdmin} channels={channels} feedId={feed?.feed_id} feedName={feed?.feed_name} isChat={false} isGroup={feed?.is_group} setChannels={setChannels} />
                </SwipeableAside>
            ) : (
                <aside className="right-aside"></aside>
            )}
        </div>
        <ConfirmModal isOpen={showDeleteConfirm} onConfirm={deleteChannel} onCancel={cancelDelete} title={`Delete ${pendingDeleteAction}`} message={`Are you sure you want to delete ${pendingDeleteAction}?`} /></>
    );
}

export default FeedHome;