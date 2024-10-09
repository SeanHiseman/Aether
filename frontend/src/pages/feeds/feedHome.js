import axios from 'axios';
import { AuthContext } from '../../components/authContext';
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChannelList from '../../components/channels/channelList';
import ChannelName from '../../components/channels/channelName';
import ChatChannel from '../../components/channels/chatChannel';
import ContentForm from "../../components/contentForm";
import FollowerChangeButton from '../../components/followerChangeButton';
import PostChannel from '../../components/channels/postChannel';

const FeedHome = () => {
    const { feed_name, channel_name } = useParams();
    const [canRemove, setCanRemove] = useState(false);
    const [channelMode, setChannelMode] = useState('post');
    const [channels, setChannels] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [feedErrorMessage, setFeedErrorMessage] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChatChannel, setIsChatChannel] = useState(false);
    const [isPostChannel, setIsPostChannel] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [feed, setFeed] = useState('');
    const [feedNotFound, setFeedNotFound] = useState(true);
    const navigate = useNavigate();
    const [newChannelName, setNewChannelName] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [showPostForm, setShowPostForm] = useState(false);
    const { viewer } = useContext(AuthContext);

    useEffect(() => {
        const fetchFeedData = async () => {
            try {
                const response = await axios.get(`/api/feed/${feed_name}`);
                const feed = response.data.feedResult;
                setIsAdmin(feed.isAdmin);
                setIsModerator(feed.isMod);
                setFeed({ feed });
                setFeedNotFound(false);
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    setFeedNotFound(true);
                }
            }
        };
        fetchFeedData();
    }, [feed_name]);

    const urlLetter = feed.isGroup ? 'g' : 'u';

    //Moderators and admins can remove content
    useEffect(() => {
        if (isAdmin || isModerator) {
            setCanRemove(true);
        };
    }, [isAdmin, isModerator]);

    //Adds channel to group
    const AddChannel = async (event) => {
        event.preventDefault();
        try {
            if (newChannelName.length === 0) {
                setErrorMessage("Channel needs a name");
            } else {
                const response = await axios.post('/api/add_feed_channel', {
                    channel_name: newChannelName,
                    feedId: feed.feedId,
                    isPosts: isPostChannel,
                    isChat: isChatChannel
                });
                if (response.data && response.status === 201) {
                    setChannels([...channels, response.data]);
                    setErrorMessage('');
                    setNewChannelName('');
                    setShowChannelForm(false);
                    navigate(`/${urlLetter}/${feed_name}/${newChannelName}`);
                } else {
                    setErrorMessage('Failed to add channel');
                }
            }
        } catch (error) {
            setErrorMessage('Failed to add channel');
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
            setErrorMessage('Error deleting channel');
        }
    };

    //Set channels to contain either posts or chats, or both
    const handleChatClick = () => setIsChatChannel((prev) => !prev);
    const handlePostClick = () => setIsPostChannel((prev) => !prev);

    //Uploads content 
    const handlePostSubmit = async (formData) => {
        formData.append('feed_id', feed.feed_id);
        formData.append('channel_id', channelRender.channel_id);
        try {
            await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShowPostForm(false);
        } catch (error) {
            setErrorMessage("Error creating post");
        }
    };

    //Toggles display of create channel form after button is pressed
    const toggleChannelForm = () => { setShowChannelForm((prev) => !prev) };

    //Checks following if group is private
    const isNotPrivateFollower = !feed.isFollower && !feed.type === 'private';

    document.title = feed.feed_name || 'Feed not found';
    if (feedNotFound) {
        return (
            <div className="group-container"> 
                <div className="channel-feed">            
                    <div className="text36">Feed not found</div>
                </div>
                <aside id="right-aside"/>
            </div>
        );
    } 
    return (    
        <div className="group-container">  
            <div className="channel-feed">
                {showPostForm ? (
                    <div id="create-post-container">
                        <ContentForm isReply={false} onSubmit={handlePostSubmit} errorMessage={errorMessage} />
                    </div>
                ) : feedErrorMessage ? (
                    <div className="text36">{feedErrorMessage}</div>
                ) : channelRender && !isNotPrivateFollower ? (
                        channelRender.is_posts && (channelMode === 'post' || !channelRender.is_chat) ? (
                        <PostChannel
                            canRemove={canRemove}
                            channelId={channelRender.channel_id}
                            channelName={channelRender.channel_name}
                            feedId={feed.feed_id}
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
                    <p className="text36">This feed is private</p>
                )}
            </div>    
            <aside id="right-aside">
                <div id="profile-summary">
                    <img className="large-group-photo" src={`/${feed.feed_photo}`} alt={feed.feed_name} />
                    {isAdmin && (
                        <Link to={`/group_settings/${feed_name}`}>
                            <button className="button">Settings</button>
                        </Link>
                    )}
                    <p className="text36">{feed.feed_name}</p>
                    <p className="description" >{feed.description}</p>
                    <p className="user-count">{feed.follower_count} {feed.follower_count === 1 ? 'follower' : 'followers'}</p>
                    <FollowerChangeButton 
                        feedId={feed.feed_id} 
                        followerId={viewer.viewerId} 
                        isFollower={feed.isFollower} 
                        isRequestSent={feed.isRequestSent} 
                        type={feed.type}
                    />
                </div>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                {channelRender && (
                    isAdmin ? (
                    <ChannelName channelId={channelRender.channel_id} channelName={channel_name} channelType={'group'} locationName={feed_name} channelUpdate={channelUpdate}/>
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
                    <div id="add-channel-section">
                        <button className="button" onClick={toggleChannelForm}>
                            {showChannelForm ? 'Close': 'Create channel'}
                        </button>
                        {showChannelForm && (
                            <form id="add-channel-form" onSubmit={AddChannel}>
                                <input className="name-input" type="text" placeholder="Channel name..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}/>
                                <label>
                                    <input type="checkbox" checked={isPostChannel} onChange={handlePostClick}/>
                                    Post Channel
                                </label>
                                <label>
                                    <input type="checkbox" checked={isChatChannel} onChange={handleChatClick}/>
                                    Chat Channel
                                </label>
                                <input className="dark-button" type="submit" value="Add"/>
                            </form>                            
                        )}
                    </div>
                )}
                <ChannelList channels={channels} feedId={feed.feed_id} feedName={feed_name} isGroup={true} setChannels={setChannels}/>
            </aside>
        </div>
    );
}

export default FeedHome;