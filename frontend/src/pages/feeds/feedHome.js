import axios from 'axios';
import { AuthContext } from '../../components/authContext';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChannelList from '../../components/channels/channelList';
import ChannelName from '../../components/channels/channelName';
import ChatChannel from '../../components/channels/chatChannel';
import ContentForm from "../../components/content/contentForm";
import FollowerChangeButton from '../../components/followerChangeButton';
import PostChannel from '../../components/channels/postChannel';

const FeedHome = () => {
    const { feed_name, channel_name } = useParams();
    const [canRemove, setCanRemove] = useState(false);
    const [channelMode, setChannelMode] = useState('post');
    const [channels, setChannels] = useState([]);
    const [feedErrorMessage, setFeedErrorMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(true);
    const [isModerator, setIsModerator] = useState(false);
    const [feed, setFeed] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(false);
    const navigate = useNavigate();
    const [newChannelName, setNewChannelName] = useState('');
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const { user, viewer } = useContext(AuthContext);

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
            if (newChannelName.length === 0) {
                setFeedErrorMessage("Channel needs a name");
            } else {
                const response = await axios.post('/api/add_feed_channel', {
                    channelName: newChannelName,
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
                    navigate(`/${urlLetter}/${feed_name}/${newChannelName}`);
                } else {
                    setFeedErrorMessage('Failed to add channel');
                }
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

    //Updates list of channels when channel name changed
    const channelUpdate = (channelId, newName) => {
        setChannels(prevChannels => 
            prevChannels.map(channel =>
                channel.channel_id === channelId ? {...channel, channel_name: newName} : channel
            )
        );
    };

    const deleteChannel = async () => {
        try {
            //Main channels are default, so can't be deleted
            if (channel_name === 'Main') {
                return;
            } else {
                await axios.delete(`/api/delete_feed_channel`, { data: {channelName: channel_name, feedId: feed.feed_id} });
                setChannels(prevChannels => prevChannels.filter(channel => channel.channel_name !== channel_name));
                navigate(`/${urlLetter}/${feed_name}/Main`);
            }
        } catch (error) {
            setFeedErrorMessage('Error deleting channel');
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
        formData.append('feed_id', feed.feed_id);
        formData.append('channel_id', channelRender.channel_id);
        formData.append('poster_id', viewer.feed_id);
        try {
            await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShowPostForm(false);
        } catch (error) {
            setPostErrorMessage("Error creating post");
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => { setShowChannelForm((prev) => !prev) };

    //Checks following if group is private
    const isNotPrivateFollower = feed?.type === 'private' && !feed?.isFollower;

    document.title = feed?.feed_name || 'Feed not found';

    if (loading) {
        return (
            <div className="feed-container">
                <div className="channel-feed">
                    <div className="text36">Loading...</div>
                </div>
                <aside id="right-aside"/>
            </div>
        );
    }
    if (feedNotFound) {
        return (
            <div className="feed-container"> 
                <div className="channel-feed">            
                    <div className="text36">Feed not found</div>
                </div>
                <aside id="right-aside"/>
            </div>
        );
    } 
    if (isNotPrivateFollower) {
        return (
            <div className="feed-container">
                <div className="channel-feed">
                    <p className="text36">This feed is private</p>
                </div>
                <aside id="right-aside"/>
            </div>
        );
    }
    return (    
        <div className="feed-container">  
            <div className="channel-feed">
                {showPostForm ? (
                    <ContentForm 
                        isReply={false} 
                        onSubmit={handlePostSubmit} 
                        postErrorMessage={postErrorMessage} 
                        setPostErrorMessage={setPostErrorMessage} 
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
                        />
                    ) : (
                        <ChatChannel
                            canRemove={canRemove}
                            channelId={channelRender.channel_id}
                            feedId={feed.feed_id}
                            isGroup={true}
                        />
                    )
                ) : (
                    <p className="text36"></p>
                )}
            </div> 
            <aside id="right-aside">
                <div id="feed-summary">
                    <img className="large-feed-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                    {isAdmin && (
                        <Link to={`/feed_settings/${feed_name}`}>
                            <button className="button">Settings</button>
                        </Link>
                    )}
                    <p className="text36">{feed.feed_name}</p>
                    <p className="description" >{feed.description}</p>
                    {(feed.is_group || user.user_id !== feed.feed_owner) && (
                        <FollowerChangeButton feed={feed} viewerId={viewer.feed_id} />
                    )}
                </div>
                {feedErrorMessage && <div className="error-message">{feedErrorMessage}</div>}
                {channelRender && (
                    isAdmin ? (
                    <ChannelName channelId={channelRender.channel_id} channelName={channel_name} isGroup={feed.is_group} locationName={feed_name} channelUpdate={channelUpdate}/>
                    ) : (
                        <p className="text36">{channel_name}</p>
                    ) 
                )}
                {isAdmin && channel_name !== 'Main' && (
                    <button className="button" onClick={() => deleteChannel()}>Delete channel</button> 
                )}
                {showPostForm && channelMode === 'post' && (
                    <div>
                        <button className="button" onClick={() => setShowPostForm(false)}>Close</button>
                    </div>
                )}
                {!showPostForm && channelMode === 'post' && (
                    <button className="button" onClick={() => setShowPostForm(true)}>Add Post</button>
                )}
                {channelRender && channelRender.is_posts && channelRender.is_chat && (
                    <div className="option-toggle">
                        <button className={channelMode === 'post' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('post')}>Posts</button>
                        <button className={channelMode === 'chat' ? 'active-mode' : 'passive-mode'} onClick={() => setChannelMode('chat')}>Chat</button>
                    </div>
                )}
                {isAdmin && (
                    <div className="add-channel-section">
                        <button className="button" onClick={toggleChannelForm}>
                            {showChannelForm ? 'Close': 'Create channel'}
                        </button>
                        {showChannelForm && (
                            <form className="add-channel-form" onSubmit={AddChannel}>
                                <input className="name-input" type="text" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                                {(feed.is_group) && (
                                    <><label>
                                        <input type="checkbox" checked={isPostChannel} onChange={handlePostClick} />
                                        Post Channel
                                    </label><label>
                                            <input type="checkbox" checked={isChatChannel} onChange={handleChatClick} />
                                            Chat Channel
                                        </label></>
                                )}
                                <input className="dark-button" type="submit" value="Add"/>
                            </form>                            
                        )}
                    </div>
                )}
                <ChannelList channels={channels} feedId={feed.feed_id} feedName={feed.feed_name} isGroup={feed.is_group} setChannels={setChannels}/>
            </aside>
        </div>
    );
}

export default FeedHome;