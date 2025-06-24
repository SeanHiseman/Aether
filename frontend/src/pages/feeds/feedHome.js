import axios from 'axios';
import AlgorithmSelector from '../../algorithms/algorithmSelector'; //Project code
import { AuthContext } from '../../components/authContext';
import { FaCog, FaEdit, FaFeatherAlt, FaFolder, FaFolderOpen, FaMinus, FaPlus, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import ChannelList from '../../components/channels/channelList';
import ChatChannel from '../../components/channels/chatChannel';
import ContentForm from '../../components/content/contentForm';
import FollowerChangeButton from '../../components/followerChangeButton';
import ManageConnectionButton from '../../components/connections/manageConnectionButton';
import PostChannel from '../../components/channels/postChannel';

const FeedHome = () => {
    const { feed_name, channel_name } = useParams();
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
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [newChannelName, setNewChannelName] = useState(''); 
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [postToEdit, setPostToEdit] = useState(null);
    const [replyingToPost, setReplyingToPost] = useState(null); 
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const { rightClasses } = useOutletContext(); 
    const showDrafts = location.pathname.endsWith('/drafts');
    const urlPrefix = feed.is_group ? 'g' : 'u';

    useEffect(() => {
        const fetchFeedData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/api/feed/${feed_name}`);
                const fetchedFeed = response.data.feedResult;
                setIsAdmin(fetchedFeed.isAdmin);
                setIsModerator(fetchedFeed.isMod);
                setIsLocked(fetchedFeed.is_locked);
                if (viewer?.feed_id === fetchedFeed.feed_id){
                    setIsAdmin(true);
                    setIsModerator(true);
                }
                setFeed(fetchedFeed);
                setFeedNotFound(false);
            } catch (error) {
                if (error.response && error.response.status === 404) {
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

    const urlLetter = feed.isGroup ? 'g' : 'u';

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
                        params: { channel_id: channelRender.channel_id, poster_id: viewer.feed_id }
                    })
                    setDraftPosts(response.data.drafts)
                } catch (error) {
                    setFeedErrorMessage("Error getting drafts");
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

    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            const baseName = "New channel";
            let finalChannelName = "";
            if (newChannelName.length === 0) {
                if (!channels.some(channel => channel.channel_name === baseName)) {
                    finalChannelName = baseName;
                } else {
                    let counter = 2;
                while (channels.some(channel => channel.channel_name === `${baseName} ${counter}`)) {
                    counter++;
                }
                finalChannelName = `${baseName} ${counter}`;
                }
            } else {
                finalChannelName = newChannelName;
                if (channels.some(channel => channel.channel_name === finalChannelName)) {
                    setFeedErrorMessage("Name already used");
                    setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                    return;
                }
            }
            if (finalChannelName === "Main") {
                setFeedErrorMessage("Cannot be named Main");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                return;
            }
            if (finalChannelName.length >= 30) {
                setFeedErrorMessage("Name too long");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                return;
            }
            const response = await axios.post('/api/add_feed_channel', {
                channelName: finalChannelName,
                feedId: feed.feed_id,
                isChat: feed.is_group ? isChatChannel : false,
                isPosts: feed.is_group ? isPostChannel : true
            });
            if (response.data && response.status === 201) {
                const newChannel = response.data.newChannel;
                const updatedChannels = [newChannel, ...channels];
                setChannels(updatedChannels);
                setFeedErrorMessage('');
                setNewChannelName('');
                setShowChannelForm(false);
                navigate(`/${urlLetter}/${feed_name}/${finalChannelName}`);
            } else {
                setFeedErrorMessage('Failed to add channel');
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            }
        } catch (error) {
            setFeedErrorMessage('Failed to add channel');
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };
    
    const channelRender = channels.find(c => c.channel_name === channel_name);

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
        //setIsDraftEdit(false); 
        setIsEdit(false);
        setPostToEdit(null);
    }, [channel_name]);

    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setFeedErrorMessage("Channel needs a name");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                return;
            }
            if (newChannelName === 'Main') {
                setFeedErrorMessage("Cannot be named Main");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                return;
            } 
            const channelId = channelRender.channel_id;
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
                        channel.channel_id === channelId ? {...channel, channel_name: newChannelName} : channel
                    )
                );
                navigate(`/${urlPrefix}/${feed_name}/${newChannelName}`);
            }
        } catch {
            setFeedErrorMessage("Error changing channel name");
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${channel_name}? All content will be lost.`)) {
            try {
                if (channel_name === 'Main') {
                    setFeedErrorMessage("Main chat cannot be deleted.");
                    setTimeout(() => { setFeedErrorMessage(''); }, 3000);
                    return;
                }
                const channelId = channelRender.channel_id;
                const response = await axios.delete('/api/delete_feed_channel', { data: { channelId } });
                if (response.data.success) {
                    setChannels(prevChannels => prevChannels.filter(channel => channel.channel_id !== channelId));
                    navigate(`/${urlPrefix}/${feed_name}/Main`);
                }
            } catch (error) {
                setFeedErrorMessage('Error deleting channel');
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            }
        }
    };

    const handleEditSubmit = async (formData) => { 
        try {
            formData.append('post_id', postToEdit.post_id);
            await axios.post('/api/edit_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShowPostForm(false);
            setIsEdit(false);
            setPostToEdit(null);
        } catch (error) {
            setFeedErrorMessage("Error editing post");
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
        }
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

    const handlePostSubmit = async (formData) => {
        if (!isAuthenticated) return;
        if (!formData) {
            setPostErrorMessage("Post cannot be empty");
            setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            return;
        }
        try {
            formData.append('poster_id', viewer.feed_id);
            await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const draftId = formData.get('draft_id')
            if (draftId !== null && draftId !== '') {
                await axios.delete('/api/remove_draft', {
                    headers: { 'Content-Type': 'application/json' },
                    data: {   
                        draft: { draft_id: draftId }
                    }
                });     
            }
            setShowPostForm(false);
        } catch (error) {
            if (error.response && error.response.status === 413) {
                setPostErrorMessage(error.response.data.message + (!user.has_membership ? ". Get membership for more" : ""));
                setTimeout(() => { setFeedErrorMessage(''); }, 10000); //Longer timeout for membership message
            } else {
                setPostErrorMessage(error.response.data.message || "Error creating post");
                setTimeout(() => { setFeedErrorMessage(''); }, 3000);
            }
        }
    };

    const handleToggleDrafts = () => {
        if (showDrafts) {
            navigate(`/${urlLetter}/${feed_name}/${channel_name}`);
        } else {
            navigate(`/${urlLetter}/${feed_name}/${channel_name}/drafts`);
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => { setShowChannelForm((prev) => !prev) };

    //Checks following if feed is private
    const privateNoView = feed?.type === 'private' && !feed?.isFollower && !feed?.isConnected;
    document.title = feed?.feed_name || 'Feed not found';

    if (loading) {
        return (
            <div className="standard-container">
                <div className="channel-feed">
                    <div className="text36">Loading...</div>
                </div>
                <aside className="right-aside"/>
            </div>
        );
    }
    if (feedNotFound) {
        return (
            <div className="standard-container"> 
                <div className="channel-feed">            
                    <div className="text36">Feed not found</div>
                </div>
                <aside className="right-aside"/>
            </div>
        );
    } 
    if (privateNoView) {
        return (
            <div className="standard-container">
                <div className="channel-feed">
                    <p className="text36">This feed is private</p>
                </div>
                <aside className="right-aside">
                    <div id="feed-summary">
                        <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                        <p className="text36">{feed.feed_name}</p>
                        <p className="description" >{feed.description}</p>
                        {viewer && isAuthenticated && (
                            <FollowerChangeButton feed={feed} viewerId={viewer.feed_id} />
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
                {showDrafts ? (
                    <PostChannel
                        channelId={channelRender?.channel_id}
                        channelName={channel_name}
                        feed={feed}
                        isDraft={true}
                        isGroup={feed.is_group}
                        onEditClick={(post) => { setShowPostForm(true); setIsEdit(true); setPostToEdit(post); handleToggleDrafts(); }}
                        onReplyClick={null}
                        posts={draftPosts}
                    />
                ) : showPostForm ? (
                    <ContentForm 
                        channelId={channelRender.channel_id} 
                        feed={feed} 
                        isEdit={isEdit} 
                        isReply={false} 
                        onEditSubmit={handleEditSubmit} 
                        onPostSubmit={handlePostSubmit}
                        populateFromPost={Boolean(postToEdit)}
                        post={postToEdit} 
                        postErrorMessage={postErrorMessage} 
                        setPostErrorMessage={setPostErrorMessage} 
                        setShowForm={setShowPostForm}
                    />
                ) : replyingToPost ? (
                    <ContentForm 
                        channelId={channelRender.channel_id} 
                        feed={feed} 
                        isEdit={false}
                        isGroup={feed.is_group} 
                        isReply={true} 
                        onPostSubmit={handlePostSubmit} 
                        post={replyingToPost} 
                        postErrorMessage={postErrorMessage} 
                        setPostErrorMessage={setPostErrorMessage} 
                        setShowForm={() => setReplyingToPost(null)}
                    />
                ) : channelRender ? (
                        channelRender.is_posts && (channelMode === 'post' || !channelRender.is_chat) ? (
                        <PostChannel
                            channelId={channelRender.channel_id}
                            channelName={channelRender.channel_name}
                            feed={feed}
                            isDraft={false}
                            isGroup={feed.is_group}
                            onEditClick={(post) => { setShowPostForm(true); setIsEdit(true); setPostToEdit(post); }}
                            onReplyClick={(post) => { setReplyingToPost(post); }}
                        />
                    ) : (
                        <ChatChannel canAdd={isAdmin} canRemove={canRemove} channelId={channelRender.channel_id} feedId={feed.feed_id} isGroup={true} isLocked={isLocked} setErrorMessage={setFeedErrorMessage}/> 
                    )
                ) : null}
            </div> 
            <aside className={rightClasses}>
                <div id="feed-summary">
                    <Link to={`/${urlLetter}/${feed_name}/Main`}>
                        <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                    </Link>
                    <div className="feed-name">
                        <Link to={`/${urlLetter}/${feed_name}/Main`}>
                            <p className="text36">{feed.feed_name}</p>
                        </Link>
                        {(isModerator || isAdmin) && (
                            <Link to={`/settings/${feed_name}`}>
                                <button className="small-icon" title="Settings">
                                    <FaCog />
                                </button>
                            </Link>
                        )}
                    </div>
                    <p className="description" >{feed.description}</p>
                    {(user?.user_id !== feed.feed_owner || feed.is_group) && isAuthenticated && viewer ? (
                        <FollowerChangeButton feed={feed} viewerId={viewer.feed_id} />
                    ) : (
                        <p className="icon-text">{feed.follower_count} {(feed.follower_count) === 1 ? 'follower' : 'followers'}</p>
                    )}
                    {/*{!isViewingSelf && !feed.is_group && (
                        <ManageConnectionButton feed={feed} viewerId={viewer.feed_id} />
                    )}*/}
                </div>
                <div className="error-message">{feedErrorMessage}</div>
                {channelRender && (
                    <div className="channel-name-section">
                        {isEditingChannelName ? (
                            <div className="change-name">
                                <textarea
                                    className="change-name-area"
                                    onChange={(e) => {
                                        e.preventDefault();
                                        const input = e.target.value;
                                        if (input.length <= 30) {
                                            setNewChannelName(input);
                                            if (input.trim() === 'main') {
                                                setFeedErrorMessage("Cannot be named 'Main'");
                                            } else {
                                                setFeedErrorMessage(""); 
                                            }
                                        } else {
                                            setFeedErrorMessage("Name too long");
                                        }
                                    }}
                                    placeholder="New name"
                                    value={newChannelName} />
                                <div className="cancel-save">
                                    <button className="small-icon" onClick={() => {setIsEditingChannelName(false); setNewChannelName(""); setFeedErrorMessage("");}} title="Cancel">
                                        <FaRegWindowClose />
                                    </button>
                                    <button className="small-icon" onClick={changeChannelName} title="Save">
                                        <FaSave />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="channel-name">
                                <Link to={`/${urlLetter}/${feed_name}/${channel_name}`}>
                                    <p className="text24">{channel_name}</p>
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
                                            <button className="small-icon" onClick={handleDelete} title="Delete channel">
                                                <FaTrash />
                                            </button>
                                        </>
                                    )}
                                    {isAdmin && (
                                        <button className="small-icon" onClick={toggleChannelForm} title={showChannelForm ? 'Close' : 'Create Channel'} >
                                            {showChannelForm ? <FaMinus /> : <FaPlus />}
                                        </button>
                                    )}
                                    {channelMode === 'post' && !showPostForm && (feed.is_group || feed.feed_owner === user?.user_id) && (!isLocked || isAdmin) && isAuthenticated && (
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
                                        <button className="small-icon" onClick={handleToggleDrafts} title={showDrafts ? 'Hide Drafts' : 'Show Drafts'}>
                                            {showDrafts ? <FaFolder /> : <FaFolderOpen />}<p className="icon-text">{showDrafts ? "Hide drafts" : "Drafts"}</p>
                                        </button>
                                    )}
                                </div>
                                <AlgorithmSelector feedId={feed.feed_id} />
                                {showChannelForm && (
                                    <form className="add-channel-form" onSubmit={AddChannel}>
                                        <input 
                                            className="name-input" 
                                            onChange={(e) => {
                                                e.preventDefault();
                                                const input = e.target.value;
                                                if (input.length <= 30) {
                                                    setNewChannelName(input);
                                                    if (input.trim() === 'main') {
                                                        setFeedErrorMessage("Cannot be named 'Main'");
                                                    } else {
                                                        setFeedErrorMessage(""); 
                                                    }
                                                } else {
                                                    setFeedErrorMessage("Name too long");
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
                <ChannelList canReorder={isAdmin} channels={channels} feedId={feed.feed_id} feedName={feed.feed_name} isChat={false} isGroup={feed.is_group} setChannels={setChannels} />
            </aside>
        </div>
    );
}

export default FeedHome;