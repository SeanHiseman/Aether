import axios from 'axios';
import AlgorithmSelector from '../../algorithms/algorithmSelector'; //Project code
import { AuthContext } from '../../components/authContext';
import { FaCog, FaEdit, FaFeatherAlt, FaFolder, FaFolderOpen, FaMinus, FaPlus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FormatNumber } from '../../functions/formatNumber';
import { ValidateTextInput } from '../../functions/validateTextInput';
import ChannelList from '../../components/channels/channelList';
import ChatChannel from '../../components/channels/chatChannel';
import ContentForm from '../../components/content/contentForm';
import FollowerChangeButton from '../../components/followerChangeButton';
import ManageConnectionButton from '../../components/connections/manageConnectionButton';
import PostChannel from '../../components/channels/postChannel';

const FeedHome = () => {
    const [canRemove, setCanRemove] = useState(false);
    const [channelMode, setChannelMode] = useState('post');
    const [channels, setChannels] = useState([]);
    const [draftPosts, setDraftPosts] = useState([]);
    const [feed, setFeed] = useState('');
    const [feedErrorMessage, setFeedErrorMessage] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [isEditingChannelName, setIsEditingChannelName] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [isNewNameValid, setIsNewNameValid] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [newChannelName, setNewChannelName] = useState(''); 
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [postToEdit, setPostToEdit] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    const [replyingToPost, setReplyingToPost] = useState(null); 
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const location = useLocation();
    const { feed_name, channel_name, post_id } = useParams();
    const isReplyMode = location.pathname.endsWith('/reply');
    const isEditMode = location.pathname.endsWith('/edit');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { rightClasses } = useOutletContext(); 
    const showDrafts = location.pathname.endsWith('/drafts');
    const urlPrefix = feed?.is_group ? 'g' : 'u';

    useEffect(() => {
        const fetchFeedData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/api/feed/${feed_name}`);
                const fetchedFeed = response.data?.feedResult;
                setIsAdmin(fetchedFeed?.isAdmin);
                setIsModerator(fetchedFeed?.isMod);
                setIsLocked(fetchedFeed?.is_locked);
                if (viewer?.feed_id === fetchedFeed?.feed_id){
                    setIsAdmin(true);
                    setIsModerator(true);
                }
                setFeed(fetchedFeed);
                setFeedNotFound(false);
            } catch (error) {
                if (error.response && error.response?.status === 404) {
                    setFeedNotFound(true);
                } else {
                    setFeedErrorMessage('Failed to load feed');
                    setTimeout(() => { setFeedErrorMessage(''); }, 3000);
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
                    const response = await axios.get('/api/get_post_drafts', {
                        params: { channel_id: channelRender?.channel_id, poster_id: viewer?.feed_id }
                    })
                    setDraftPosts(response.data?.drafts)
                } catch (error) {
                    setFeedErrorMessage(error.response.data?.message || "Error getting drafts");
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
            if (editData) {
                setShowPostForm(true);
                setIsEdit(true);
                setPostToEdit(editData);
                return;
            }
            const fetchPost = async () => {
                const isDraftPath = location.pathname.includes('/drafts/');
                if (isDraftPath) {
                    const draft = draftPosts.find(d => d.draft_id === post_id);
                    if (draft) {
                        setShowPostForm(true);
                        setIsEdit(true);
                        setPostToEdit(draft);
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
                    const response = await axios.get('/api/channel_posts', { 
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
                    setPostErrorMessage(error.response.data?.message || "Error fetching post to edit");
                }
            };
            fetchPost();
        }
        else if (!isEditMode) {
            setShowPostForm(false);
            setIsEdit(false);
            setPostToEdit(null);
        }
    }, [isEditMode, post_id, queryClient, location.state, draftPosts]);

    useEffect(() => {
        if (!isReplyMode || !post_id || !feed?.feed_id) return;
        let cachedPost = queryClient.getQueryData(['singlePost', post_id]);
        if (cachedPost) {
            setReplyingToPost(cachedPost);
            return;
        }
        const fetchPost = async () => {
            try {
                const response = await axios.get('/api/channel_posts', {
                    params: { isSingle: true, feedId: feed.feed_id, postId: post_id },
                });
                const post = response.data?.post;
                if (post) {
                    queryClient.setQueryData(['singlePost', post_id], post);
                    setReplyingToPost(post);
                } else {
                    setReplyingToPost({ error: true }); 
                }
            } catch (e) {
                setReplyingToPost({ error: true });
            }
        };
        fetchPost();

    }, [isReplyMode, post_id, feed?.feed_id, queryClient]);

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
            const response = await axios.post('/api/add_feed_channel', {
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
            setFeedErrorMessage('Failed to add channel');
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };
    
    const channelRender = channels.find(c => c?.channel_name === channel_name);

    useEffect(() => {
        if (!channelRender && channels.length > 0) {
            setFeedErrorMessage('Channel not found. Please check the url.');
        } else {
            setFeedErrorMessage('');
        }
    }, [channelRender, channels]);

    //Resets channel states when switching channels
    useEffect(() => {
        setShowPostForm(false);
        setReplyingToPost(null);
        setIsEdit(false);
        setPostToEdit(null);
    }, [channel_name, feed_name]);

    const changeChannelName = async (event) => {
        if (!isAuthenticated) return;
        event.preventDefault();
        try {
            const channelId = channelRender?.channel_id;
            const response = await axios.post('/api/change_channel_name', {
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
            setFeedErrorMessage("Error changing channel name");
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };

    const deleteChannel = async () => {
        if (!isAuthenticated) return;
        if (window.confirm(`Are you sure you want to delete ${channel_name}? All content will be lost.`)) {
            try {
                if (channel_name === 'Main') {
                    setFeedErrorMessage("Main chat cannot be deleted.");
                    setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                    return;
                }
                const channelId = channelRender?.channel_id;
                const response = await axios.delete('/api/delete_feed_channel', { data: { channelId } });
                if (response.data?.success) {
                    setChannels(prevChannels => prevChannels.filter(channel => channel?.channel_id !== channelId));
                    navigate(`/${urlPrefix}/${feed_name}/Main`);
                }
            } catch (error) {
                setFeedErrorMessage('Error deleting channel');
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            }
        }
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
            const response = await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const draftId = formData.get('draft_id')
            //Delete if posting from a draft
            if (draftId !== null && draftId !== '') {
                await axios.delete('/api/remove_draft', {
                    headers: { 'Content-Type': 'application/json' },
                    data: {   
                        draft: { draft_id: draftId },
                        isPosting: true,
                    }
                });     
            }
            const postId = response.data?.result?.post_id;
            const navigationUrl = `/${urlPrefix}/${feed_name}/${channel_name}/${postId}`;
            navigate(navigationUrl);
            setShowPostForm(false);
        } catch (error) {
            if (error.response && error.response?.status === 413) {
                setPostErrorMessage(error.response.data?.message + (!user?.has_membership ? ". Get membership for more" : ""));
                setTimeout(() => { setFeedErrorMessage(''); }, 10000); //Longer timeout for membership message
            } else {
                setPostErrorMessage(error.response.data?.message || "Error creating post");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            }
        }
    };

    const refreshPosts = () => {
        setRefreshTrigger(!refreshTrigger);
    };

    const toggleDrafts = () => {
        if (showDrafts) {
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
        } else {
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}/drafts`);
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => { setShowChannelForm((prev) => !prev) };

    //Decides contents of feed
    const renderContentForm = (isReply = false) => (
        <ContentForm 
            channelId={channelRender?.channel_id} 
            feed={feed} 
            isEdit={isReply ? false : isEdit} 
            isGroup={feed?.is_group}
            isReply={isReply} 
            onPostSubmit={postSubmit}
            populateFromPost={isReply ? false : Boolean(postToEdit)}
            post={isReply ? replyingToPost : postToEdit} 
            postErrorMessage={postErrorMessage} 
            setPostErrorMessage={setPostErrorMessage} 
            setShowForm={isReply ? () => {
                setReplyingToPost(null);
                navigate(`/${urlPrefix}/${feed_name}/${channel_name}${replyingToPost?.post_id ? `/${replyingToPost.post_id}` : ''}`);
            } : () => {
                setShowPostForm(false);
                setIsEdit(false);
                setPostToEdit(null);
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
    const renderPostChannel = (isDraft = false) => (
        <PostChannel
            channelId={channelRender?.channel_id}
            channelName={isDraft ? channel_name : channelRender?.channel_name}
            feed={feed}
            isDraft={isDraft}
            isEditMode={isEditMode}
            isGroup={feed?.is_group}
            refreshTrigger={isDraft ? undefined : refreshTrigger}
            posts={isDraft ? draftPosts : undefined}
        />
    );
    const renderChannelContent = () => {
        if (isEditMode && showPostForm) return renderContentForm(false);
        if (isReplyMode) { return renderContentForm(true); }
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

    if (loading) {
        return (
            <div className="standard-container">
                <div className="channel-feed">
                    <div className="large-text faded-text">Loading...</div>
                </div>
                <aside className="right-aside"/>
            </div>
        );
    }
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
                <aside className="right-aside">
                    <div id="feed-summary">
                        <img className="large-feed-photo" src={`${feed?.feed_photo}`} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
                        <p className="large-text bold">{feed?.feed_name}</p>
                        <p className="description" >{feed?.description}</p>
                        {viewer && isAuthenticated && (
                            <FollowerChangeButton feed={feed} viewerId={viewer?.feed_id} />
                        )}
                        {/*{!isViewingSelf && !feed.is_group && (
                            <ManageConnectionButton feed={feed} viewerId={viewer.feed_id} />
                        )}*/}
                    </div>
                </aside>
            </div>
        );
    }
    return (    
        <div className="standard-container">  
            <div className="channel-feed">
                {renderChannelContent()}
            </div> 
            <aside className={rightClasses}>
                <div id="feed-summary">
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
                    <p className="description" >{feed?.description}</p>
                    {(user?.user_id !== feed?.feed_owner || feed?.is_group) && isAuthenticated && viewer ? (
                        <FollowerChangeButton feed={feed} showName={false} showVertical={true} viewerId={viewer?.feed_id} />
                    ) : (
                        <p className="icon-text">{FormatNumber(feed?.follower_count)} {(feed?.follower_count) === 1 ? 'follower' : 'followers'}</p>
                    )}
                    {/*{!isViewingSelf && !feed.is_group && (
                        <ManageConnectionButton feed={feed} viewerId={viewer.feed_id} />
                    )}*/}
                </div>
                <div className="tiny-text faded-text">{feedErrorMessage}</div>
                {channelRender && (
                    <div className="channel-name-section">
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
                                    }}
                                    placeholder="New name"
                                    value={newChannelName} 
                                />
                                <div className="cancel-save">
                                    <button className="small-icon" onClick={() => {setIsEditingChannelName(false); setNewChannelName(""); setFeedErrorMessage("");}} title="Cancel">
                                        <FaRegWindowClose />
                                    </button>
                                    <button className={!isNewNameValid ? "small-icon disabled" : "small-icon"} onClick={changeChannelName} title="Save">
                                        <FaSave />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="channel-name">
                                <Link to={`/${urlPrefix}/${feed_name}/${channel_name}`}>
                                    <p className="medium-text">{channel_name}</p>
                                </Link>
                                <div className="button-group">
                                    {channel_name !== "Main" && isAdmin && ( 
                                        <>
                                            <button
                                                className="small-icon"
                                                onClick={() => {
                                                    setIsEditingChannelName(true);
                                                    setNewChannelName(channel_name);
                                                }}
                                                title="Edit name"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button className="small-icon" onClick={deleteChannel} title="Delete channel">
                                                <FaTrash />
                                            </button>
                                        </>
                                    )}
                                    {isAdmin && (
                                        <button className="small-icon" onClick={toggleChannelForm} title={showChannelForm ? 'Close' : 'Create Channel'} >
                                            {showChannelForm ? <FaMinus /> : <FaPlus />}
                                        </button>
                                    )}
                                    {channelMode === 'post' && !showPostForm && (feed?.is_group || feed?.feed_owner === user?.user_id) && (!isLocked || isAdmin) && isAuthenticated && (
                                        <button
                                            className="small-icon"
                                            onClick={() => {
                                                setIsEdit(false);
                                                //setIsDraftEdit(false);
                                                setPostToEdit(null);
                                                setShowPostForm(true);
                                            }}
                                            title="Create Post"
                                        >
                                            <FaFeatherAlt />
                                        </button>
                                    )}
                                    {showPostForm && (
                                        <button className="small-icon" onClick={toggleDrafts} title={showDrafts ? 'Hide Drafts' : 'Show Drafts'}>
                                            {showDrafts ? <FaFolder /> : <FaFolderOpen />}<p className="icon-text">{showDrafts ? "Hide drafts" : "Drafts"}</p>
                                        </button>
                                    )}
                                </div>
                                {isAuthenticated && (<AlgorithmSelector locationId={channelRender?.channel_id} refreshPosts={refreshPosts} />)} {/*Project code*/}
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
                                        {/*{feed.is_group && (
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
                                        )}*/}
                                        <button className="small-icon" title="Create channel" type="submit">
                                            <FaPlus />
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {/*{channelRender && channelRender.is_posts && channelRender.is_chat && (
                    <div className="option-toggle">
                        <button className={channelMode === 'post' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('post')}>Posts</button>
                        <button className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('chat')}>Chat</button>
                    </div>
                )}*/}
                <ChannelList canReorder={isAdmin} channels={channels} feedId={feed?.feed_id} feedName={feed?.feed_name} isChat={false} isGroup={feed?.is_group} setChannels={setChannels} />
            </aside>
        </div>
    );
}

export default FeedHome;