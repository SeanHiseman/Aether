import axios from 'axios';
import { AuthContext } from '../../components/authContext';
import { FaCog, FaEdit, FaFeatherAlt, FaMinus, FaPlus, FaTrash } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip'
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChannelList from '../../components/channels/channelList';
import ChatChannel from '../../components/channels/chatChannel';
import ContentForm from "../../components/content/contentForm";
import FollowerChangeButton from '../../components/followerChangeButton';
import ManageConnectionButton from '../../components/connections/manageConnectionButton';
import PostChannel from '../../components/channels/postChannel';

const FeedHome = () => {
    const { feed_name, channel_name } = useParams();
    const [canRemove, setCanRemove] = useState(false);
    const [channelMode, setChannelMode] = useState('post');
    const [channels, setChannels] = useState([]);
    const [feed, setFeed] = useState('');
    const [feedErrorMessage, setFeedErrorMessage] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [isEditingChannelName, setIsEditingChannelName] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [isModerator, setIsModerator] = useState(false);
    const navigate = useNavigate();
    const [newChannelName, setNewChannelName] = useState('');
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [postToEdit, setPostToEdit] = useState(null);
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const { user, viewer } = useContext(AuthContext);
    const isViewingSelf = feed.feed_id === viewer.feed_id;
    const urlPrefix = feed.is_group ? 'g' : 'u';

    useEffect(() => {
        const fetchFeedData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/api/feed/${feed_name}`);
                const feed = response.data.feedResult;
                setIsAdmin(feed.isAdmin);
                setIsModerator(feed.isMod);
                if (viewer.feed_id === feed.feed_id){
                    setIsAdmin(true);
                    setIsModerator(true);
                }
                setFeed(feed);
                setFeedNotFound(false);
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    setFeedNotFound(true);
                } else {
                    setFeedErrorMessage('Failed to load feed');
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

    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            const channelName = newChannelName.length === 0 ? 'New channel' : newChannelName; //New channel doesn't have to have a name set
            if (channelName === "Main") {
                setFeedErrorMessage("Cannot be named Main");
                return;
            }
            if (channelName.length >= 30) {
                setFeedErrorMessage("Name too long"); 
                return; 
            } 
            const channelExists = channels.some(channel => channel.channel_name === channelName);
            if (channelExists) {
                setFeedErrorMessage("Name already used");
                return;
            }
            const response = await axios.post('/api/add_feed_channel', {
                channelName: channelName,
                feedId: feed.feed_id,
                isPosts: feed.is_group ? isPostChannel : true,
                isChat: feed.is_group ? isChatChannel : false
            });
            if (response.data && response.status === 201) {
                const newChannel = response.data.newChannel;
                const updatedChannels = [...channels, newChannel];
                setChannels(updatedChannels);
                setFeedErrorMessage('');
                setNewChannelName('');
                setShowChannelForm(false);
                navigate(`/${urlLetter}/${feed_name}/${channelName}`);
            } else {
                setFeedErrorMessage('Failed to add channel');
            }
        } catch (error) {
            setFeedErrorMessage('Failed to add channel');
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

    const changeChannelName = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setFeedErrorMessage("Channel needs a name");
                return;
            //Names over 30 characters already prevented
            }
            if (newChannelName === 'Main') {
                setFeedErrorMessage("Channel cannot be named Main");
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
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${channel_name}?`)) {
            try {
                if (channel_name === 'Main') {
                    setFeedErrorMessage("Main chat cannot be deleted.");
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
            }
        }
    };

    const handleEditSubmit = async (formData) => {
        formData.append('post_id', postToEdit.post_id);
        try {
            await axios.post('/api/edit_post', formData, {
                header: { 'Content-Type': 'multipart/form-data' },
            });
            setShowPostForm(false);
            setIsEdit(false);
            setPostToEdit(null);
        } catch (error) {
            setFeedErrorMessage("Error creating post");
        }
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

    //Uploads content 
    const handlePostSubmit = async (formData) => {
        if (!formData) {
            setPostErrorMessage("Post cannot be empty");
            return;
        }
        try {
            formData.append('feed_id', feed.feed_id);
            formData.append('channel_id', channelRender.channel_id);
            formData.append('poster_id', viewer.feed_id);
            await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShowPostForm(false);
        } catch (error) {
            setFeedErrorMessage("Error creating post");
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
                <aside id="right-aside"/>
            </div>
        );
    }
    if (feedNotFound) {
        return (
            <div className="standard-container"> 
                <div className="channel-feed">            
                    <div className="text36">Feed not found</div>
                </div>
                <aside id="right-aside"/>
            </div>
        );
    } 
    if (privateNoView) {
        return (
            <div className="standard-container">
                <div className="channel-feed">
                    <p className="text36">This feed is private</p>
                </div>
                <aside id="right-aside">
                    <div id="feed-summary">
                        <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                        <p className="text36">{feed.feed_name}</p>
                        <p className="description" >{feed.description}</p>
                        {feed.is_group && (
                            <FollowerChangeButton feed={feed} viewerId={viewer.feed_id} />
                        )}
                        {!isViewingSelf && !feed.is_group && (
                            <ManageConnectionButton feed={feed} viewerId={viewer.feed_id} />
                        )}
                    </div>
                </aside>
            </div>
        );
    }
    return (    
        <div className="standard-container">  
            <div className="channel-feed">
                {showPostForm ? (
                    <ContentForm 
                        isEdit={isEdit}
                        isReply={false} 
                        onSubmit={isEdit ? handleEditSubmit : handlePostSubmit} 
                        postErrorMessage={postErrorMessage} 
                        post={postToEdit}
                        setPostErrorMessage={setPostErrorMessage} 
                        setShowForm={setShowPostForm}
                    />
                ) : feedErrorMessage ? (
                    <div className="text36">{feedErrorMessage}</div>
                ) : channelRender ? (
                        channelRender.is_posts && (channelMode === 'post' || !channelRender.is_chat) ? (
                        <PostChannel
                            canRemove={canRemove}
                            channelId={channelRender.channel_id}
                            channelName={channelRender.channel_name}
                            feed={feed}
                            isGroup={true}
                            onEditClick={(post) => {
                                setShowPostForm(true);
                                setIsEdit(true);
                                setPostToEdit(post);
                            }}
                        />
                    ) : (
                        <ChatChannel
                            canRemove={canRemove}
                            channelId={channelRender.channel_id}
                            feedId={feed.feed_id}
                            isGroup={true}
                        />
                    )
                ) : null}
            </div> 
            <aside id="right-aside">
                <div id="feed-summary">
                    <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                    <div className="feed-name">
                        <p className="text36">{feed.feed_name}</p>
                        {isAdmin && (
                            <Link to={`/feed_settings/${feed_name}`}>
                                <button className="small-icon">
                                    <FaCog />
                                </button>
                            </Link>
                        )}
                    </div>
                    <p className="description" >{feed.description}</p>
                    {(feed.is_group || (user.user_id !== feed.feed_owner && feed.type === 'public')) && (
                        <FollowerChangeButton feed={feed} viewerId={viewer.feed_id} />
                    )}
                    {!isViewingSelf && !feed.is_group && (
                        <ManageConnectionButton feed={feed} viewerId={viewer.feed_id} />
                    )}
                </div>
                {feedErrorMessage && <div className="error-message">{feedErrorMessage}</div>}
                {channelRender && (
                    <div className="channel-name-section">
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
                                        } else {
                                            setFeedErrorMessage("Name too long");
                                        }
                                    }}
                                />
                                <div className="cancel-save">
                                    <button
                                        className="button"
                                        onClick={() => {
                                            setIsEditingChannelName(false);
                                            setNewChannelName("");
                                            setFeedErrorMessage("");
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button className="button" onClick={changeChannelName}>
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="chat-name">
                                <p className="text36">{channel_name}</p>
                                <div className="button-group">
                                    {channel_name !== "Main" && isAdmin && ( 
                                        <>
                                            <button
                                                className="small-icon"
                                                onClick={() => {
                                                    setIsEditingChannelName(true);
                                                    setNewChannelName(channel_name);
                                                }}
                                            >
                                                <FaEdit />
                                            </button>
                                            <button className="small-icon" onClick={handleDelete}>
                                                <FaTrash />
                                            </button>
                                        </>
                                    )}
                                    {isAdmin && (
                                        <button className="small-icon" onClick={toggleChannelForm}>
                                            {showChannelForm ? <FaMinus /> : <FaPlus />}
                                        </button>
                                    )}
                                    {channelMode === "post" && !showPostForm && (
                                        <button
                                            className="small-icon"
                                            onClick={() => {
                                                setIsEdit(false);
                                                setPostToEdit(null);
                                                setShowPostForm(true);
                                            }}
                                        >
                                            <FaFeatherAlt />
                                        </button>
                                    )}
                                {showChannelForm && (
                                    <form className="add-channel-form" onSubmit={AddChannel}>
                                        <input
                                            className="name-input"
                                            type="text"
                                            placeholder="Channel name..."
                                            value={newChannelName}
                                            onChange={(e) => setNewChannelName(e.target.value)}
                                        />
                                        {feed.is_group && (
                                            <div className="channel-options">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={isPostChannel}
                                                        onChange={handlePostClick}
                                                    />
                                                    Post Channel
                                                </label>
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChatChannel}
                                                        onChange={handleChatClick}
                                                    />
                                                    Chat Channel
                                                </label>
                                            </div>
                                        )}
                                        <button className="small-icon" type="submit">
                                            <FaPlus />
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                )}
                {channelRender && channelRender.is_posts && channelRender.is_chat && (
                    <div className="option-toggle">
                        <button className={channelMode === 'post' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('post')}>Posts</button>
                        <button className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('chat')}>Chat</button>
                    </div>
                )}
                <ChannelList channels={channels} feedId={feed.feed_id} feedName={feed.feed_name} isChat={false} isGroup={feed.is_group} setChannels={setChannels} setErrorMessage={setFeedErrorMessage} />
            </aside>
        </div>
    );
}

export default FeedHome;